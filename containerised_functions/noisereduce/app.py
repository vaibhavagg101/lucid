import base64
import firebase_admin
import io
import json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import noisereduce as nr
import numpy as np
import os
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from firebase_admin import firestore
from google.cloud import storage
from pydantic import BaseModel
from pydub import AudioSegment
from pydub.effects import normalize
from typing import Optional

app = FastAPI(title="Noisereduce API - Google Cloud Run")

# Initialize Firebase Admin
if not firebase_admin._apps:
    firebase_admin.initialize_app()
db = firestore.client()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://lucid--lucid-b0b9e.asia-east1.hosted.app",
        "https://lucid.vaibhavaggarwal.dev"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_EXTENSIONS = {'wav', 'mp3', 'm4a', 'aac', 'webm', 'ogg', 'flac', 'aiff', 'aif'}

def getFileFromGCS(gsBucket: str, filepath: str):
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(gsBucket)
        blob = bucket.blob(filepath)
        
        file = io.BytesIO()
        blob.download_to_file(file)
        file.seek(0)
        file.filename = filepath.split('/')[-1]
        return file
    except Exception as e:
        print(f"Error fetching file {filepath} from bucket {gsBucket}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch file from storage")

def uploadFileToGCS(gsBucket: str, filepath: str, file_buffer: io.BytesIO, case: str, filetype:  Optional[str] = None) -> str:
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(gsBucket)
        blob = bucket.blob(f"{filepath}/{case}")
        if not filetype:
            blob.upload_from_file(file_buffer)
        else:
            blob.upload_from_file(file_buffer, content_type=filetype)
            
        return f"{filepath}/{case}"
        
    except Exception as e:
        print(f"Error uploading file {filepath}/{case} to bucket {gsBucket}: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload file to storage")

class NoiseReduceRequest(BaseModel):
    gsBucket: str
    filepath: str
    filetype: str
    noiseclip: bool
    startPoint: Optional[int] = None
    endPoint: Optional[int] = None

def process_audio(request: NoiseReduceRequest):
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

    # Create file buffers for use in core logic
    # (initialising here to only prevent error in finally block)
    file = None
    original_image = None
    reduced_image = None
    out_buffer = None
    
    # CORE LOGIC
    try:
        file = getFileFromGCS(gsBucket, filepath)

        filename = file.filename
        if '.' not in filename:
            raise HTTPException(status_code=400, detail="Invalid file name in gs bucket. File name must include an extension.")
        file_ext = filename.rsplit('.', 1)[-1].lower()
        if file_ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Invalid file type was uploaded. Only WAV, MP3, M4A, AAC, WEBM, and OGG files are supported.")

        audio = AudioSegment.from_file(file, format=(None if file_ext != "wav" else "wav"))
        samples = np.array(audio.get_array_of_samples())
        if audio.channels == 2:
            samples = samples.reshape((-1, 2)).T # [ L R L R L R ] to [ [L R] [L R] [L R] ] to [ [L L L] [R R R] ]

        # Perform noise reduction
        if noiseclip:
            # Use noise clip if provided with stationary set to true
            # This will only work with constant noise in the audio; inform user on frontend accordingly
            start_frame = int((startPoint / 1000.0) * audio.frame_rate)
            end_frame = int((endPoint / 1000.0) * audio.frame_rate)
            
            if start_frame >= samples.shape[-1]:
                raise HTTPException(status_code=400, detail="startPoint is beyond the duration of the audio")
                
            noise_clip = samples[:, start_frame:end_frame] if audio.channels == 2 else samples[start_frame:end_frame]
            reduced_noise = nr.reduce_noise(y=samples, y_noise=noise_clip, sr=audio.frame_rate, stationary=True, prop_decrease=0.8, n_jobs=2)
        else:
            # No noiseclip provided by the user
            # Stationary defaults to False
            reduced_noise = nr.reduce_noise(y=samples, sr=audio.frame_rate, prop_decrease=0.8, n_jobs=2)
        
        # GENERATE PLOTS
        # Displays before and after waveform of the audio to the user
        plot_samples = samples.T if samples.ndim > 1 else samples
        plot_reduced = reduced_noise.T if reduced_noise.ndim > 1 else reduced_noise
        
        # Downsample plots to prevent slowdown
        step = max(1, plot_samples.shape[0] // 50000)
        plot_samples_ds = plot_samples[::step]
        plot_reduced_ds = plot_reduced[::step]

        # Original Plot
        fig_orig, ax_orig = plt.subplots(figsize=(20, 4))
        ax_orig.plot(plot_samples_ds)
        ax_orig.set_title("Original Audio")
        original_image = io.BytesIO()
        fig_orig.savefig(original_image, format='png')
        plt.close(fig_orig)
        original_image.seek(0)
        
        # Reduced Plot
        fig_red, ax_red = plt.subplots(figsize=(20, 4))
        ax_red.plot(plot_reduced_ds)
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
        export_format = file_ext
        if file_ext == 'm4a':
            export_format = 'ipod' # pydub maps m4a to the ipod ffmpeg format
        if cleaned_audio.sample_width == 4 and file_ext == 'wav':
            # Export 32-bit audio as 32-bit float (pcm_f32le) instead of 32-bit INT default
            cleaned_audio.export(out_buffer, format=export_format, parameters=["-acodec", "pcm_f32le"])
        else:
            cleaned_audio.export(out_buffer, format=export_format)
        out_buffer.seek(0)
        
        # Upload files to GCS
        original_image_path = uploadFileToGCS(gsBucket, filepath, original_image, "og-plot.png", "image/png")
        reduced_image_path = uploadFileToGCS(gsBucket, filepath, reduced_image, "reduced-plot.png", "image/png")
        nr_audio_path = uploadFileToGCS(gsBucket, filepath, out_buffer, f"nr-audio.{file_ext}", filetype)

        return {
            "original_plot_path": original_image_path,
            "reduced_plot_path": reduced_image_path,
            "nr_audio_path": nr_audio_path
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Internal error processing audio: {e}")
        raise HTTPException(status_code=500, detail="Internal server error occurred during audio processing")
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

class PubSubMessage(BaseModel):
    message: dict

@app.post('/noisereduce-pubsub')
def process_audio_pubsub(pubsub_message: PubSubMessage):
    if "data" not in pubsub_message.message:
        return {"status": "error", "detail": "Invalid Pub/Sub message format"}
        
    try:
        data = base64.b64decode(pubsub_message.message["data"]).decode("utf-8")
        payload = json.loads(data)
    except Exception as e:
        print(f"Error decoding Pub/Sub message: {e}")
        return {"status": "error", "detail": "Failed to decode payload"}
        
    jobId = payload.get('jobId')
    if not jobId:
        return {"status": "error", "detail": "No jobId provided"}

    job_ref = db.collection('jobs').document(jobId)
    
    try:
        request = NoiseReduceRequest(
            gsBucket=payload.get('gsBucket'),
            filepath=payload.get('filepath'),
            filetype=payload.get('filetype'),
            noiseclip=payload.get('noiseclip', False),
            startPoint=payload.get('startPoint'),
            endPoint=payload.get('endPoint')
        )
        
        # Call the existing process_audio function directly
        result = process_audio(request)
        
        # Update Firestore with success and paths
        job_ref.update({
            "status": "completed",
            "original_plot_path": result["original_plot_path"],
            "reduced_plot_path": result["reduced_plot_path"],
            "nr_audio_path": result["nr_audio_path"]
        })
        
    except HTTPException as e:
        job_ref.update({"status": "failed", "error": str(e.detail)})
        print(f"Job {jobId} failed with HTTPException: {e.detail}")
    except Exception as e:
        job_ref.update({"status": "failed", "error": "Internal processing error"})
        print(f"Job {jobId} failed with Error: {e}")
        
    # Always return 200 to acknowledge the Pub/Sub message
    return {"status": "processed"}

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host='0.0.0.0', port=port)