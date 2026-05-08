import io
import base64
import numpy as np
import noisereduce as nr
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydub import AudioSegment
from pydub.effects import normalize
from typing import Optional
import requests
from google.cloud import storage
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

app = FastAPI(title="Noisereduce API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_EXTENSIONS = {'wav', 'mp3', 'm4a', 'aac'}

def normalise(audio: AudioSegment):
    samples = np.array(audio.get_array_of_samples())
    
    if audio.sample_width == 2:
        samples = samples.astype(np.float32)
        samples /= 32768.0
    elif audio.sample_width in (3, 4):
        samples = samples.astype(np.float32)
        samples /= 2147483648.0
    else:
        raise ValueError(f"Unsupported bit depth: {audio.sample_width * 8}-bit")

    return samples

def denormalise(float_samples, sample_width=2):
    float_samples = np.array(float_samples, dtype=np.float32)
    float_samples = np.nan_to_num(float_samples)

    if sample_width == 2:
        scaled = float_samples * 32768.0
        return np.clip(scaled, -32768, 32767).astype(np.int16)
    elif sample_width in (3, 4):
        scaled = float_samples * 2147483648.0
        return np.clip(scaled, -2147483648, 2147483647).astype(np.int32)
    else:
        raise ValueError("Unsupported sample width. Use 2, 3 or 4.")

def getFileFromGCS(gsBucket: str, filepath: str):
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(gsBucket)
        blob = bucket.blob(filepath)
        signed_url = blob.generate_signed_url(expiration=300, version='v4', method='GET')
        response = requests.get(signed_url)
        if response.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Failed to download file from gs://{gsBucket}/{filepath}: {response.status_code}")
        file = io.BytesIO(response.content)
        file.seek(0)
        file.filename = filepath.split('/')[-1]
        return file
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching file from Google Cloud Storage: {str(e)}")


# CRITICAL: Use `def` instead of `async def` here. 
# Because noisereduce/matplotlib are synchronous and CPU-heavy, 
# a standard `def` tells FastAPI to run this in a separate thread, 
# preventing the main server loop from freezing!
@app.post('/noisereduce')
def process_audio(gsBucket: str, filepath: str = None, noiseclip: bool = False, startPoint: Optional[int] = None, endPoint: Optional[int] = None):
    if not gsBucket:
        raise HTTPException(status_code=400, detail="No gs bucket provided")
    if not filepath:
        raise HTTPException(status_code=400, detail="No filepath provided")
    
    if noiseclip:
        if startPoint is None or endPoint is None:
            raise HTTPException(status_code=400, detail="startPoint and endPoint must be provided when noiseclip is True.")
        if startPoint < 0 or endPoint <= startPoint:
            raise HTTPException(status_code=400, detail="Invalid noiseclip parameters. Ensure startPoint and endPoint are valid integers with endPoint > startPoint.")

    file = getFileFromGCS(gsBucket, filepath)

    filename = file.filename
    if '.' not in filename:
        raise HTTPException(status_code=400, detail="Invalid file name. File must include an extension.")
    file_ext = filename.rsplit('.', 1)[-1].lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file type. Only WAV, MP3, and M4A supported.")

    try:
        # Pydub can read directly from the downloaded file-like object
        audio = AudioSegment.from_file(file, format=file_ext)
        # samples = normalise(audio)
        samples = audio.to_numpy_array()
        if audio.channels == 2:
            samples = samples.reshape((-1, 2)).T
        
        # max_val_before = np.max(np.abs(samples))

        # Perform noise reduction
        if noiseclip:
            noise_clip = samples[:, startPoint:endPoint] if audio.channels == 2 else samples[startPoint:endPoint]
            reduced_noise = nr.reduce_noise(y=samples, y_noise=noise_clip, sr=audio.frame_rate, stationary=True, prop_decrease=0.8, n_jobs=-1)
        else:
            reduced_noise = nr.reduce_noise(y=samples, sr=audio.frame_rate, prop_decrease=0.8, n_jobs=-1)

        # max_val_after = np.max(np.abs(reduced_noise))
        # if max_val_after > 0.01:
        #     makeup_gain = max_val_before / max_val_after
        #     reduced_noise = reduced_noise * makeup_gain
        
        plot_samples = samples.T if samples.ndim > 1 else samples
        plot_reduced = reduced_noise.T if reduced_noise.ndim > 1 else reduced_noise

        # Generate Original Plot
        fig_orig, ax_orig = plt.subplots(figsize=(20, 4))
        ax_orig.plot(plot_samples)
        ax_orig.set_title("Original Audio")
        original_image = io.BytesIO()
        fig_orig.savefig(original_image, format='png')
        plt.close(fig_orig)
        
        # Generate Reduced Plot
        fig_red, ax_red = plt.subplots(figsize=(20, 4))
        ax_red.plot(plot_reduced)
        ax_red.set_title("Reduced Noise Audio")
        reduced_image = io.BytesIO()
        fig_red.savefig(reduced_image, format='png')
        plt.close(fig_red)

        # Denormalise and export audio
        # cleaned_samples = denormalise(reduced_noise, audio.sample_width)
        if audio.channels == 2:
            reduced_noise = reduced_noise.T.flatten()

        cleaned_audio = audio._spawn(reduced_noise.tobytes())
        cleaned_audio = normalize(cleaned_audio)
        out_buffer = io.BytesIO()
        cleaned_audio.export(out_buffer, format=file_ext)
        
        # Convert to Base64
        original_plot_base64 = base64.b64encode(original_image.getvalue()).decode('utf-8')
        reduced_plot_base64 = base64.b64encode(reduced_image.getvalue()).decode('utf-8')
        audio_base64 = base64.b64encode(out_buffer.getvalue()).decode('utf-8')

        return {
            'original_plot': original_plot_base64,
            'reduced_plot': reduced_plot_base64,
            'nr_audio': audio_base64
        }

    except Exception as e:
        # Let FastAPI handle the 500 error gracefully
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Always ensure the downloaded file is closed to free resources
        try:
            file.close()
        except Exception:
            pass

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=5000)