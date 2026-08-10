import base64
import firebase_admin
import json
import math
import os
import tempfile
import uvicorn
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from firebase_admin import firestore
from google.cloud import storage
from pydantic import BaseModel
import pretty_midi

from tuttut.logic.tab import Tab, fill_measure_str
from tuttut.logic.theory import Tuning

app = FastAPI(title="Tabs API - Google Cloud Run")

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

def format_time(seconds: float) -> str:
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{mins:02d}:{secs:02d}"

def build_timestamped_tab_str(tab_obj: Tab, measures_per_line: int = 3) -> str:
    """
    Formats the tuttut Tab object into wrapped multi-line blocks with timestamp headers.
    
    Args:
        tab_obj (Tab): Processed tuttut Tab object.
        measures_per_line (int): Number of measures to group per horizontal block.
        
    Returns:
        str: Formatted ASCII tab string with timestamps.
    """
    res_blocks = []
    tuning_strings = tab_obj.tuning.strings
    nstrings = len(tuning_strings)
    all_measures = tab_obj.tab["measures"]
    
    # Process in chunks of measures_per_line
    for chunk_idx in range(0, len(all_measures), measures_per_line):
        chunk_measures = all_measures[chunk_idx : chunk_idx + measures_per_line]
        
        # Extract event timestamps within this chunk
        chunk_times = [
            event["time"]
            for m in chunk_measures
            for event in m["events"]
            if "time" in event
        ]
        start_t = min(chunk_times) if chunk_times else 0.0
        end_t = max(chunk_times) if chunk_times else start_t
        
        m_start = chunk_idx + 1
        m_end = chunk_idx + len(chunk_measures)
        header = f"[{format_time(start_t)} - {format_time(end_t)}] Measures {m_start}-{m_end}"
        
        # Build 6 string lines for this chunk
        string_lines = []
        for string in tuning_strings:
            h = string.degree
            h += "||" if len(h) > 1 else " ||"
            string_lines.append(h)
            
        for measure in chunk_measures:
            for ievent, event in enumerate(measure["events"]):
                if "notes" in event:
                    for note in event["notes"]:
                        string, fret = note["string"], note["fret"]
                        string_lines[string] += str(fret)

                    next_event_timing = (
                        measure["events"][ievent + 1]["measure_timing"]
                        if ievent < len(measure["events"]) - 1
                        else 1.0
                    )
                    dashes_to_add = max(
                        1, math.floor((next_event_timing - event["measure_timing"]) * 16)
                    )

                    string_lines = fill_measure_str(string_lines)

                    for istring in range(nstrings):
                        string_lines[istring] += "-" * dashes_to_add

            for istring in range(nstrings):
                string_lines[istring] += "|"
                
        block_text = header + "\n" + "\n".join(string_lines)
        res_blocks.append(block_text)
        
    return "\n\n".join(res_blocks)

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

class TabRequest(BaseModel):
    gsBucket: str
    filepath: str
    audio_id: str

@app.post('/process-tab')
def process_tab(request: TabRequest):
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
            local_midi_path = os.path.join(tmpdir, f"input.{file_ext}")
            download_file_from_gcs(gs_bucket, filepath, local_midi_path)
            
            # Load MIDI file using pretty_midi
            midi_data = pretty_midi.PrettyMIDI(local_midi_path)
            
            # Process MIDI file with tuttut to generate guitar tablature
            tab_name = Path(filename).stem
            tuning = Tuning()  # Standard guitar tuning (E A D G B E)
            
            tab = Tab(tab_name, tuning, midi_data, output_dir=tmpdir)
            
            # Generate multi-line timestamped ASCII tab
            timestamped_tab_text = build_timestamped_tab_str(tab, measures_per_line=3)
            
            # Save generated tab to .txt file
            local_txt_path = os.path.join(tmpdir, f"{tab_name}.txt")
            with open(local_txt_path, "w") as f:
                f.write(timestamped_tab_text + "\n")
                
            # Upload to GCS
            tabs_filepath = filepath.rsplit('.', 1)[0] + ".txt"
            upload_file_to_gcs(gs_bucket, tabs_filepath, local_txt_path, content_type="text/plain")
            
            # Update Firestore audio document
            audio_ref = db.collection('audio_files').document(audio_id)
            audio_ref.update({
                "tabs_files": firestore.ArrayUnion([tabs_filepath])
            })
            
            return {
                "tabs_filepath": tabs_filepath
            }
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Internal error processing tabs: {e}")
        raise HTTPException(status_code=500, detail="Internal server error occurred during tab processing")

class PubSubMessage(BaseModel):
    message: dict

@app.post('/tabs-pubsub')
def process_tabs_pubsub(pubsub_message: PubSubMessage):
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
        request = TabRequest(
            gsBucket=payload.get('gsBucket'),
            filepath=payload.get('filepath'),
            audio_id=audio_id
        )
        
        result = process_tab(request)
        
        # Update Firestore with success and path
        try:
            job_ref.update({
                "status": "completed",
                "tabs_filepath": result["tabs_filepath"]
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
