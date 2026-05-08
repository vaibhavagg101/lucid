import io
import base64
from pydantic import BaseModel
import numpy as np
import noisereduce as nr
from fastapi import FastAPI, HTTPException
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

def uploadFileToGCS(gsBucket: str, filepath: str, file_buffer: io.BytesIO) -> str:
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(gsBucket)
        blob = bucket.blob(f"{filepath}/nr")
        blob.upload_from_file(file_buffer)
        return blob.generate_signed_url(expiration=3600, version='v4', method='GET')
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading file to Google Cloud Storage: {str(e)}")

class NoiseReduceRequest(BaseModel):
    gsBucket: str
    filepath: str
    noiseclip: bool
    startPoint: Optional[int] = None
    endPoint: Optional[int] = None

@app.post('/noisereduce')
def process_audio(request: NoiseReduceRequest):
    gsBucket = request.gsBucket
    filepath = request.filepath
    noiseclip = request.noiseclip
    startPoint = request.startPoint
    endPoint = request.endPoint

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
        audio = AudioSegment.from_file(file, format=file_ext)
        samples = audio.to_numpy_array()
        if audio.channels == 2:
            samples = samples.reshape((-1, 2)).T

        # Perform noise reduction
        if noiseclip:
            noise_clip = samples[:, startPoint:endPoint] if audio.channels == 2 else samples[startPoint:endPoint]
            reduced_noise = nr.reduce_noise(y=samples, y_noise=noise_clip, sr=audio.frame_rate, stationary=True, prop_decrease=0.8, n_jobs=-1)
        else:
            reduced_noise = nr.reduce_noise(y=samples, sr=audio.frame_rate, prop_decrease=0.8, n_jobs=-1)
        
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

        if audio.channels == 2:
            reduced_noise = reduced_noise.T.flatten()
        cleaned_audio = audio._spawn(reduced_noise.tobytes())
        cleaned_audio = normalize(cleaned_audio)
        out_buffer = io.BytesIO()
        cleaned_audio.export(out_buffer, format=file_ext)
        
        original_image_url = uploadFileToGCS(gsBucket, filepath, original_image)
        reduced_image_url = uploadFileToGCS(gsBucket, filepath, reduced_image)
        nr_audio_url = uploadFileToGCS(gsBucket, filepath, out_buffer)

        # Convert to Base64
        # original_plot_base64 = base64.b64encode(original_image.getvalue()).decode('utf-8')
        # reduced_plot_base64 = base64.b64encode(reduced_image.getvalue()).decode('utf-8')
        # audio_base64 = base64.b64encode(out_buffer.getvalue()).decode('utf-8')

        return {
            "original_plot_url": original_image_url,
            "reduced_plot_url": reduced_image_url,
            "nr_audio_url": nr_audio_url
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            file.close()
        except Exception:
            pass

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=5000)