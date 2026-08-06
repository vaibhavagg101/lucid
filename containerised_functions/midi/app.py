import base64
import firebase_admin
import json
import os
import uvicorn
import tempfile
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from firebase_admin import firestore
from google.cloud import storage
from pydantic import BaseModel
from typing import Optional
from basic_pitch.inference import predict_and_save
from basic_pitch import ICASSP_2022_MODEL_PATH

app = FastAPI(title="MIDI Conversion API - Google Cloud Run")

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

def download_file_from_gcs(gs_bucket: str, filepath: str, local_path: str):
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(gs_bucket)
        blob = bucket.blob(filepath)
        blob.download_to_filename(local_path)
    except Exception as e:
        print(f"Error fetching file {filepath} from bucket {gs_bucket}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch file from storage")

def upload_file_to_gcs(gs_bucket: str, filepath: str, local_path: str, content_type: Optional[str] = None) -> str:
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(gs_bucket)
        blob = bucket.blob(filepath)
        if content_type:
            blob.upload_from_filename(local_path, content_type=content_type)
        else:
            blob.upload_from_filename(local_path)
        return filepath
    except Exception as e:
        print(f"Error uploading file {filepath} to bucket {gs_bucket}: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload file to storage")

class MidiRequest(BaseModel):
    gsBucket: str
    filepath: str
    audio_id: str

def process_midi(request: MidiRequest):
    gs_bucket = request.gsBucket
    filepath = request.filepath
    audio_id = request.audio_id

    # Strip the gs:// if frontend passes it
    if gs_bucket and gs_bucket.startswith("gs://"):
        gs_bucket = gs_bucket[5:]

    # Validate inputs
    if not gs_bucket:
        raise HTTPException(status_code=400, detail="No gs bucket provided")
    if not filepath:
        raise HTTPException(status_code=400, detail="No filepath provided")

    try:
        filename = filepath.split('/')[-1]
        if '.' not in filename:
            raise HTTPException(status_code=400, detail="Invalid file name. Must include extension.")
        
        file_ext = filename.rsplit('.', 1)[-1].lower()
        
        with tempfile.TemporaryDirectory() as tmpdir:
            local_audio_path = os.path.join(tmpdir, f"audio.{file_ext}")
            download_file_from_gcs(gs_bucket, filepath, local_audio_path)
            
            # Generate MIDI using basic-pitch
            predict_and_save(
                [local_audio_path],
                tmpdir,
                True,
                False,
                False,
                False,
                ICASSP_2022_MODEL_PATH
            )
            
            # Find generated MIDI file
            midi_local_path = None
            for f in os.listdir(tmpdir):
                if f.endswith(".mid"):
                    midi_local_path = os.path.join(tmpdir, f)
                    break
                    
            if not midi_local_path:
                raise HTTPException(status_code=500, detail="Failed to generate MIDI file")
                
            # Upload to GCS
            midi_filepath = filepath.rsplit('.', 1)[0] + ".mid"
            upload_file_to_gcs(gs_bucket, midi_filepath, midi_local_path)
            
            # Update Firestore audio document
            audio_ref = db.collection('audio_files').document(audio_id)
            audio_ref.update({
                "midi_files": firestore.ArrayUnion([midi_filepath])
            })
            
            return {
                "midi_filepath": midi_filepath
            }
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Internal error processing midi: {e}")
        raise HTTPException(status_code=500, detail="Internal server error occurred during MIDI processing")

class PubSubMessage(BaseModel):
    message: dict

@app.post('/midi-pubsub')
def process_midi_pubsub(pubsub_message: PubSubMessage):
    if "data" not in pubsub_message.message:
        return {"status": "error", "detail": "Invalid Pub/Sub message format"}
        
    try:
        data = base64.b64decode(pubsub_message.message["data"]).decode("utf-8")
        payload = json.loads(data)
    except Exception as e:
        print(f"Error decoding Pub/Sub message: {e}")
        return {"status": "error", "detail": "Failed to decode payload"}
        
    job_id = payload.get('jobId')
    if not job_id:
        return {"status": "error", "detail": "No jobId provided"}

    job_ref = db.collection('jobs').document(job_id)
    
    audio_id = payload.get('audioId') or payload.get('audio_id')
    if not audio_id:
        return {"status": "error", "detail": "No audioId provided"}

    try:
        request = MidiRequest(
            gsBucket=payload.get('gsBucket'),
            filepath=payload.get('filepath'),
            audio_id=audio_id
        )
        
        result = process_midi(request)
        
        # Update Firestore with success and path
        try:
            job_ref.update({
                "status": "completed",
                "midi_filepath": result["midi_filepath"]
            })
        except Exception as db_err:
            print(f"Error updating job {job_id} to completed in Firestore: {db_err}")
        
    except HTTPException as e:
        print(f"Job {job_id} failed with HTTPException: {e.detail}")
        try:
            job_ref.update({"status": "failed", "error": str(e.detail)})
        except Exception as db_err:
            print(f"Error updating job {job_id} to failed in Firestore: {db_err}")
    except Exception as e:
        print(f"Job {job_id} failed with Error: {e}")
        try:
            job_ref.update({"status": "failed", "error": "Internal processing error"})
        except Exception as db_err:
            print(f"Error updating job {job_id} to failed in Firestore: {db_err}")
        
    # Always return 200 to acknowledge the Pub/Sub message
    return {"status": "processed"}

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host='0.0.0.0', port=port)
