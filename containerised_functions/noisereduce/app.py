import os
import io
from pydantic import BaseModel
import noisereduce as nr
from fastapi import FastAPI, HTTPException, Security
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from pydub import AudioSegment
from pydub.effects import normalize
from typing import Optional
import requests
from google.cloud import storage
import matplotlib
import numpy as np
matplotlib.use('Agg')
import matplotlib.pyplot as plt

app = FastAPI(title="Noisereduce API - Google Cloud Run")

API_KEY = os.getenv("NOISEREDUCE_API_KEY")
if not API_KEY:
    raise RuntimeError("NOISEREDUCE_API_KEY environment variable missing.")

api_key_header = APIKeyHeader(name="X-API-Key")
def get_api_key(api_key: str = Security(api_key_header)):
    if api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API Key")
    return api_key

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://lucid--lucid-b0b9e.asia-east1.hosted.app",
        "https://lucid.vaibhavaggarwal.dev"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_EXTENSIONS = {'wav', 'mp3', 'm4a', 'aac', 'webm', 'ogg'}

def getFileFromGCS(gsBucket: str, filepath: str):
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(gsBucket)
        blob = bucket.blob(filepath)
        signed_url = blob.generate_signed_url(expiration=300, version='v4', method='GET')
        response = requests.get(signed_url)
        if response.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Failed to download file from {gsBucket}/{filepath}: {response.status_code} \nFailed Signed URL: {signed_url}")
        file = io.BytesIO(response.content)
        file.seek(0)
        file.filename = filepath.split('/')[-1]
        return file
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching file from Google Cloud Storage: {str(e)}")

def uploadFileToGCS(gsBucket: str, filepath: str, file_buffer: io.BytesIO, case: str, filetype:  Optional[str] = None) -> str:
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(gsBucket)
        blob = bucket.blob(f"{filepath}/{case}")
        if not filetype:
            blob.upload_from_file(file_buffer)
        else:
            blob.upload_from_file(file_buffer, content_type=filetype)
        return blob.generate_signed_url(expiration=3600, version='v4', method='GET')
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading file to Google Cloud Storage: {str(e)}")

class NoiseReduceRequest(BaseModel):
    gsBucket: str
    filepath: str
    filetype: str
    noiseclip: bool
    startPoint: Optional[int] = None
    endPoint: Optional[int] = None

@app.post('/noisereduce')
def process_audio(request: NoiseReduceRequest, api_key: str = Security(get_api_key)):
    gsBucket = request.gsBucket
    filepath = request.filepath
    filetype = request.filetype
    
    # Strip the gs:// if frontend passes it
    if gsBucket and gsBucket.startswith("gs://"):
        gsBucket = gsBucket[5:]
        
    noiseclip = request.noiseclip
    startPoint = request.startPoint
    endPoint = request.endPoint

    # Validate inputs
    if not gsBucket:
        raise HTTPException(status_code=400, detail="No gs bucket provided")
    if not filepath:
        raise HTTPException(status_code=400, detail="No filepath provided")
    
    if noiseclip:
        if startPoint is None or endPoint is None:
            raise HTTPException(status_code=400, detail="Noiseclip is enabled, but startPoint and endPoint not provided.")
        if startPoint < 0 or endPoint <= startPoint:
            raise HTTPException(status_code=400, detail="Invalid noiseclip parameters. Ensure startPoint and endPoint are valid with endPoint > startPoint.")

    file = getFileFromGCS(gsBucket, filepath)

    filename = file.filename
    if '.' not in filename:
        raise HTTPException(status_code=400, detail="Invalid file name in gs bucket. File name must include an extension.")
    file_ext = filename.rsplit('.', 1)[-1].lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file type was uploaded. Only WAV, MP3, M4A, AAC, WEBM, and OGG files are supported.")

    # Create file buffers for use in core logic
    # (initialising here to only prevent error in finally block)
    original_image = None
    reduced_image = None
    out_buffer = None
    
    # CORE LOGIC
    try:
        audio = AudioSegment.from_file(file, format=file_ext)
        samples = np.array(audio.get_array_of_samples())
        if audio.channels == 2:
            samples = samples.reshape((-1, 2)).T # [ L R L R L R ] to [ [L R] [L R] [L R] ] to [ [L L L] [R R R] ]

        # Perform noise reduction
        if noiseclip:
            # Use noise clip if provided with stationary set to true
            # This will only work with constant noise in the audio; inform user on frontend accordingly
            start_frame = int((startPoint / 1000.0) * audio.frame_rate)
            end_frame = int((endPoint / 1000.0) * audio.frame_rate)
            noise_clip = samples[:, start_frame:end_frame] if audio.channels == 2 else samples[start_frame:end_frame]
            reduced_noise = nr.reduce_noise(y=samples, y_noise=noise_clip, sr=audio.frame_rate, stationary=True, prop_decrease=0.8, n_jobs=-1)
        else:
            # No noiseclip provided by the user
            # Stationary defaults to False
            reduced_noise = nr.reduce_noise(y=samples, sr=audio.frame_rate, prop_decrease=0.8, n_jobs=-1)
        
        # GENERATE PLOTS
        # Displays before and after waveform of the audio to the user
        plot_samples = samples.T if samples.ndim > 1 else samples
        plot_reduced = reduced_noise.T if reduced_noise.ndim > 1 else reduced_noise

        # Original Plot
        fig_orig, ax_orig = plt.subplots(figsize=(20, 4))
        ax_orig.plot(plot_samples)
        ax_orig.set_title("Original Audio")
        original_image = io.BytesIO()
        fig_orig.savefig(original_image, format='png')
        plt.close(fig_orig)
        original_image.seek(0)
        
        # Reduced Plot
        fig_red, ax_red = plt.subplots(figsize=(20, 4))
        ax_red.plot(plot_reduced)
        ax_red.set_title("Reduced Noise Audio")
        reduced_image = io.BytesIO()
        fig_red.savefig(reduced_image, format='png')
        plt.close(fig_red)
        reduced_image.seek(0)

        if audio.channels == 2:
            reduced_noise = reduced_noise.T.flatten() # [ [L L L] [R R R] ] to [ L R L R L R ]
        cleaned_audio = audio._spawn(reduced_noise.tobytes())
        cleaned_audio = normalize(cleaned_audio)
        out_buffer = io.BytesIO()
        cleaned_audio.export(out_buffer, format=file_ext)
        out_buffer.seek(0)
        
        # Upload files to GCS
        original_image_url = uploadFileToGCS(gsBucket, filepath, original_image, "og-plot")
        reduced_image_url = uploadFileToGCS(gsBucket, filepath, reduced_image, "reduced-plot")
        nr_audio_url = uploadFileToGCS(gsBucket, filepath, out_buffer, "nr-audio", filetype)

        return {
            "original_plot_url": original_image_url,
            "reduced_plot_url": reduced_image_url,
            "nr_audio_url": nr_audio_url
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up
        if file:
            file.close()
        if original_image:
            original_image.close()
        if reduced_image:
            reduced_image.close()
        if out_buffer:
            out_buffer.close()
        
        plt.close('all')

if __name__ == '__main__':
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host='0.0.0.0', port=port)