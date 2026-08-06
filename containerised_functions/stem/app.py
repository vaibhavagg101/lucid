import base64
import json
import os
import tempfile
from pydantic import BaseModel
from pydub import AudioSegment
import demucs.separate
from fastapi import FastAPI, HTTPException
from typing import Optional
import firebase_admin
from firebase_admin import firestore
from google.cloud import storage
import io

app = FastAPI(title="Stem API - Google Cloud Run")

# Initialize Firebase Admin
if not firebase_admin._apps:
    firebase_admin.initialize_app()
db = firestore.client()

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

class PubSubMessage(BaseModel):
    message: dict    

@app.post("/stem-pubsub")
def processAudio(pubsub_message: PubSubMessage):
    if "data" not in pubsub_message.message:
        return {"status": "error", "detail": "Invalid Pub/Sub message format"}
        
    try:
        data = base64.b64decode(pubsub_message.message["data"]).decode("utf-8")
        payload = json.loads(data)
    except Exception as e:
        print(f"Error decoding Pub/Sub message: {e}")
        return {"status": "error", "detail": "Failed to decode payload"}

    try:
        separation_option = int(payload.get('separationOption', 0))
        
        if separation_option <= 0:
            return {"status": "success", "detail": "No separation required"}

        if separation_option > 0:
            gsBucket = payload.get('gsBucket')
            filepath = payload.get('filepath')
            filetype = payload.get('filetype')
            if not filetype or not gsBucket or not filepath:
                return {"status": "error", "detail": "Missing required parameters for separation"}

            if gsBucket.startswith("gs://"):
                gsBucket = gsBucket[5:]
            local_file_path = getFileFromGCS(gsBucket, filepath)
            if not local_file_path:
                return {"status": "error", "detail": "Failed to fetch file from GCS"}

            out_dir = tempfile.mkdtemp()
            # Separation function
            try:
                wav_supported_exts = ['wav', 'flac', 'aiff']
                stem = separation_option
                cmd = []
                model = "htdemucs"

                if filetype not in wav_supported_exts:
                    cmd = ["--mp3"]
                    filetype = "audio/mpeg"
                else:
                    def get_encoding(sample_width):
                        match sample_width:
                            case 3:
                                return "--int24"
                            case 4:
                                return "--float32"
                            case _:
                                return None
                    filetype = "audio/wav"
                    encoding = get_encoding(AudioSegment.from_file(local_file_path).sample_width)
                    if encoding:
                        cmd.extend(["--wav", f"{encoding}"])

                if stem == 2:
                    cmd.extend(["--two-stems", "vocals"])
                elif stem == 6:
                    model = "htdemucs_6s"
                cmd.extend(["-n", model])
                
                cmd.extend(["-o", out_dir])
                cmd.append(local_file_path)
                
                demucs.separate.main(cmd)
                
                filename_base = os.path.splitext(os.path.basename(local_file_path))[0]
                demucs_output_dir = os.path.join(out_dir, model, filename_base)
                
                uploaded_files = []
                if os.path.exists(demucs_output_dir):
                    for file in os.listdir(demucs_output_dir):
                        local_file = os.path.join(demucs_output_dir, file)
                        if os.path.isfile(local_file):
                            with open(local_file, "rb") as f:
                                obj_name = uploadFileToGCS(gsBucket, filepath, f, case=f"demucs/{file}", filetype=filetype)
                                uploaded_files.append(obj_name)

                try:
                    audio_id = filepath.split('/')[2].split('.')[0]
                    doc_ref = db.collection('audio_files').document(audio_id)
                    doc_ref.update({
                        'separated_files': uploaded_files,
                        'separation_status': 'completed'
                    })
                except Exception as db_err:
                    print(f"Error saving to Firestore: {db_err}")
                    return {"status": "error", "detail": "Failed to save results to Firestore"}
                
                return {"status": "success", "uploaded_files": uploaded_files}
            except Exception as e:
                print(f"Error during audio separation: {e}")
                return {"status": "error", "detail": "Audio separation failed"}
            finally:
                # Cleanup local inputs and outputs regardless of success or failure
                try:
                    if os.path.exists(local_file_path):
                        os.remove(local_file_path)
                    import shutil
                    if os.path.exists(out_dir):
                        shutil.rmtree(out_dir)
                except Exception as cleanup_err:
                    print(f"Error during cleanup: {cleanup_err}")

    except Exception as e:
        print(f"Error processing audio: {e}")
        return {"status": "error", "detail": "Failed to process audio"}