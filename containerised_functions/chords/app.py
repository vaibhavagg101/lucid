import base64
from typing import Optional
import firebase_admin
import io
import json
import os
import subprocess
import tempfile
import uvicorn
import pandas as pd
import key_detection as kd
import librosa

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from firebase_admin import firestore
from google.cloud import storage

app = FastAPI(title="Chords API - Google Cloud Run")

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

def getFileFromGCS(gsBucket: str, filepath: str):
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(gsBucket)
        blob = bucket.blob(filepath)
        
        # Need the file locally for external python script
        _, local_path = tempfile.mkstemp(suffix=os.path.splitext(filepath)[1])
        blob.download_to_filename(local_path)
        return local_path
    except Exception as e:
        print(f"Error fetching file from GCS: {e}")
        return None

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


@app.post("/chords-pubsub")
def process_pubsub(envelope: dict):
    try:
        if not envelope:
            raise HTTPException(status_code=400, detail="Bad Request: No JSON body")
        if "message" not in envelope:
            raise HTTPException(status_code=400, detail="Bad Request: Missing 'message' field")
        
        pubsub_message = envelope["message"]
        
        if isinstance(pubsub_message, dict) and "data" in pubsub_message:
            data_str = base64.b64decode(pubsub_message["data"]).decode("utf-8")
            payload = json.loads(data_str)
        else:
            raise HTTPException(status_code=400, detail="Bad Request: Invalid Pub/Sub message format")

        audio_id = payload.get("audio_id")
        gsBucket = payload.get("gsBucket")
        # Strip the gs:// if frontend passes it
        if gsBucket and gsBucket.startswith("gs://"):
            gsBucket = gsBucket[5:]
        filepath = payload.get("filepath")
        
        if not gsBucket or not filepath or not audio_id:
            raise HTTPException(status_code=400, detail="Missing required parameters in message data")

        filename = filepath.split('/')[-1]
        local_audio_path = None
        local_lab_path = None
        local_csv_path = None

        try:
            # 1. Download file Locally
            local_audio_path = getFileFromGCS(gsBucket, filepath)
            if not local_audio_path:
                raise HTTPException(status_code=404, detail="File could not be downloaded from GCS")

            # 2. Run chord extraction script
            base_dir = os.path.dirname(os.path.abspath(__file__))
            script_dir = os.path.join(base_dir, "ISMIR2019-Large-Vocabulary-Chord-Recognition")
            script_path = os.path.join(script_dir, "chord_recognition.py")
            
            local_lab_path = f"{local_audio_path}_chord.lab"
            local_csv_path = f"{local_audio_path}_chord.csv"

            command = ["python3", script_path, local_audio_path, local_lab_path]
            print(f"Running command: {' '.join(command)}")

            try:
                # Run inside the script's directory so it finds its local dependencies
                subprocess.run(command, check=True, cwd=script_dir)
                print("Chord recognition completed successfully.")
            except subprocess.CalledProcessError as e:
                print(f"Error running chord recognition: {e}")
                raise HTTPException(status_code=500, detail="Chord recognition script failed")

            if not os.path.exists(local_lab_path):
                raise HTTPException(status_code=500, detail=f"Output file {local_lab_path} not found")

            try:
                df = pd.read_csv(
                    local_lab_path, 
                    sep=r'\s+', 
                    header=None, 
                    names=["start_time", "end_time", "chord"]
                )
                df.to_csv(local_csv_path, index=False)
                print(f"Saved chords to local csv: {local_csv_path}")
            except Exception as e:
                print(f"Error parsing dataframe/saving csv: {e}")
                raise HTTPException(status_code=500, detail="Failed to parse chords lab file")

            # Key detection from chords
            try:
                detected_key = kd.detect_key_from_chords(local_csv_path)
            except Exception as e:
                print(f"Error detecting key from chords: {e}")
                detected_key = "Unknown"

            # BPM estimation
            try:                
                # Load with default sr=22050 for faster processing
                audio, sr = librosa.load(local_audio_path)
                tempo, _ = librosa.beat.beat_track(y=audio, sr=sr)
                
                # In librosa >= 0.10, tempo is a 1D array
                bpm = float(tempo[0]) if hasattr(tempo, "__len__") else float(tempo)
            except Exception as e:
                print(f"Error estimating BPM: {e}")
                bpm = None

            # Upload resulting CSV to GCS
            filename_csv = f"{filename.rsplit('.', 1)[0]}_chords.csv"
            with open(local_csv_path, "rb") as csv_file_buffer:
                gsBucket_path = uploadFileToGCS(
                    gsBucket, 
                    filepath, 
                    file_buffer=csv_file_buffer, 
                    case=filename_csv, 
                    filetype="text/csv"
                )

            # Update Firestore document
            try:
                doc_ref = db.collection('audio_files').document(audio_id)
                doc_ref.update({
                    'chords_csv_filepath': gsBucket_path,
                    'key': detected_key,
                    'bpm': bpm
                })
            except Exception as e:
                print(f"Error saving chords metadata to Firestore: {e}")
                raise HTTPException(status_code=500, detail="Failed to save chords metadata to Firestore")

            return {"status": "success", "detail": "Audio processed successfully"}
        finally:
            # Clean up local files
            for path in [local_audio_path, local_lab_path, local_csv_path]:
                if path and os.path.exists(path):
                    os.remove(path)
                    print(f"Deleted temporary file: {path}")

    except HTTPException as e:
        print(f"HTTP Exception [{e.status_code}]: {e.detail}")
        return {"status": "error", "detail": e.detail}
                    
    except Exception as e:
        print(f"Error processing audio chords: {e}")
        return {"status": "error", "detail": "Failed to process audio chords"}

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host='0.0.0.0', port=port)
