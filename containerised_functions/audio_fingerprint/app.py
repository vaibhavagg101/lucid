import base64
import firebase_admin
import io
import json
import math
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import os
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from firebase_admin import firestore
from google.cloud import storage
from matplotlib.colors import LinearSegmentedColormap
from pydantic import BaseModel
from pydub import AudioSegment
from scipy.fft import rfft
from typing import Optional

app = FastAPI(title="Audio Fingerprint API - Google Cloud Run")

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

# ALLOWED_EXTENSIONS = {'wav', 'mp3', 'm4a', 'aac', 'webm', 'ogg', 'flac', 'aiff', 'aif'}

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

class PubSubMessage(BaseModel):
    message: dict

@app.post('/audio-fingerprint-pubsub')
def process_audio_pubsub(pubsub_message: PubSubMessage):
    if "data" not in pubsub_message.message:
        return {"status": "error", "detail": "Invalid Pub/Sub message format"}
        
    try:
        data = base64.b64decode(pubsub_message.message["data"]).decode("utf-8")
        payload = json.loads(data)
    except Exception as e:
        print(f"Error decoding Pub/Sub message: {e}")
        return {"status": "error", "detail": "Failed to decode payload"}

    try:        
        audio_id = payload.get("audio_id")
        gsBucket = payload.get("gsBucket")
        # Strip the gs:// if frontend passes it
        if gsBucket and gsBucket.startswith("gs://"):
            gsBucket = gsBucket[5:]
        filepath = payload.get("filepath")
        filename = filepath.split('/')[-1]
        if not all([audio_id, gsBucket, filepath]):
            return {"status": "error", "detail": "Missing required fields in payload"}
    except Exception as e:
        print(f"Error parsing payload: {e}")
        return {"status": "error", "detail": "Failed to parse payload"}

    try:
        file_from_gcs = getFileFromGCS(gsBucket, filepath)
    except Exception as e:
        print(f"Error fetching file from GCS: {e}")
        return {"status": "error", "detail": "Failed to fetch file from GCS"}

    # CORE Logic
    try:
        file = AudioSegment.from_file(file_from_gcs)
        audio_frame_rate = file.frame_rate
        audio_channels = file.channels
        if audio_channels == 2:
            file = file.set_channels(1)
        samples = file.get_array_of_samples()
        numpy_array = np.array(samples)

        frequencies = [int(440*(2**(i/12))) for i in range(-48,37)]
        mid_frequencies = [(frequencies[i] + frequencies[i+1])//2 for i in range(len(frequencies)-1)]

        image_array = []
        image_array_amplitudes = []
        max_octave_indexes = []
        max_amplitude = -math.inf

        prev_sample_number = 0
        for sample_number in range(audio_frame_rate, len(numpy_array), audio_frame_rate):
            fft_array = rfft(numpy_array[prev_sample_number:sample_number]) #ignore half of the frequencies since they are mirrored
            magnitudes = np.abs(fft_array)
            octaves_amplitude = [int(np.mean(magnitudes[mid_frequencies[i]:mid_frequencies[i+1]])) for i in range(len(mid_frequencies)-1)]
            curr_max_amplitude = np.max(octaves_amplitude)
            if max_amplitude < curr_max_amplitude:
                max_amplitude = curr_max_amplitude    
            image_array_amplitudes.append(octaves_amplitude)
            max_octave_indexes.append(np.argmax(octaves_amplitude))
            prev_sample_number = sample_number

        for octaves_amplitude in image_array_amplitudes:
            octaves_db = [round(20 * math.log10(max(x, 1) / max_amplitude), 1) for x in octaves_amplitude]
            image_array.append(octaves_db)
        
        dark_blue = (25/255, 39/255, 108/255) 
        light_blue = (240/255, 248/255, 255/255) 
        cmap = LinearSegmentedColormap.from_list('custom_blue', [light_blue, dark_blue])
        image_array = np.array(image_array)

        # Highlight max frequency in each slice (max_octave_indexes)
        rgb_image_array = np.zeros((image_array.shape[0], image_array.shape[1], 3))

        for i in range(image_array.shape[0]):
            for j in range(image_array.shape[1]):
                norm_val = (image_array[i, j] - np.min(image_array)) / (0 - np.min(image_array))
                color = cmap(norm_val)[:3]
                rgb_image_array[i, j] = color
            # highlight maximum frequency index with (255, 202, 40)
            max_idx = max_octave_indexes[i]
            rgb_image_array[i, max_idx] = (255/255, 202/255, 40/255)


        fig, ax = plt.subplots(figsize=(12, 12))
        file_buffer = io.BytesIO()

        try:
            try:
                ax.imshow(rgb_image_array, aspect='auto')
                ax.axis('off')
                plt.tight_layout()
                plt.savefig(file_buffer, format='png', dpi=300, bbox_inches='tight', pad_inches=0)
                file_buffer.seek(0)
            except Exception as e:
                print(f"Error generating fingerprint image: {e}")
                raise HTTPException(status_code=500, detail="Failed to generate fingerprint image")
            
            try:
                filename_png = f"{filename.rsplit('.', 1)[0]}_fingerprint.png"
                gsBucket_path = uploadFileToGCS(gsBucket, filepath, file_buffer, filename_png, "image/png")
            except Exception as e:
                print(f"Error uploading fingerprint image to GCS: {e}")
                raise HTTPException(status_code=500, detail="Failed to upload fingerprint image to GCS")
        finally:
            file_buffer.close()
            plt.close(fig)

        try:
            doc_ref = db.collection('audio_files').document(audio_id)
            doc_ref.update({
                'fingerprint_image_path': gsBucket_path,
                'channels': audio_channels,
                'frame_rate': audio_frame_rate,
                'sample_width': file.sample_width,
            })
        except Exception as e:
            print(f"Error saving fingerprint metadata to Firestore: {e}")
            raise HTTPException(status_code=500, detail="Failed to save fingerprint metadata to Firestore")

        return {"status": "success", "detail": "Audio processed successfully"}
    except Exception as e:
        print(f"Error processing audio: {e}")
        return {"status": "error", "detail": "Failed to process audio"}

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host='0.0.0.0', port=port)