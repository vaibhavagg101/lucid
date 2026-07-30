import base64
import json
from pydantic import BaseModel
from pydub import AudioSegment
import demucs.separate
from fastapi import FastAPI, HTTPException
from typing import Optional
import firebase_admin
from firebase_admin import firestore
from google.cloud import storage
import io

app = FastAPI(title="Stem MIDI Key - Google Cloud Run")

# # Initialize Firebase Admin
# if not firebase_admin._apps:
#     firebase_admin.initialize_app()
# db = firestore.client()

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

class PubSubMessage(BaseModel):
    message: dict

# def separateTracks():
    

@app.post("/stem-midi-key/pubsub")
def processAudio(pubsub_message: PubSubMessage):
    if "data" not in pubsub_message.message:
        return {"status": "error", "detail": "Invalid Pub/Sub message format"}
        
    try:
        data = base64.b64decode(pubsub_message.message["data"]).decode("utf-8")
        payload = json.loads(data)
    except Exception as e:
        print(f"Error decoding Pub/Sub message: {e}")
        return {"status": "error", "detail": "Failed to decode payload"}

    # Variables for processing
    # separate_audio - true or false
    # stem - 4 or 6 if seaparated_audio is true else None
    # midi - true or false

    separate_audio: bool = payload.get('separated_audio')
    stem: Optional[int] = 0
    if separate_audio:
        stem = payload.get('stem')
    # generate_stems()
    midi: bool = payload.get('midi')

    # try:
    #     separateTracks()
    # except:

# # audio_files doc firestore:
# bpm null
# (null)
# chordProgression null
# (null)
# filename "recording_2026-07-15_05-43-04"
# (string)
# filepath "cEoM6QYM8lcPtDHIru9ioHeW4WE2/audio/935ltxjLInv6jQCaaiaS"
# (string)
# filetype "m4a"
# (string)
# id "935ltxjLInv6jQCaaiaS"
# (string)
# key null
# (null)
# noiseReducedFilepath null
# (null)
# separationOption 0
# (int64)
# uploadedAt 15 July 2026 at 05:43:07 UTC+5:30
# (timestamp)
# userId "cEoM6QYM8lcPtDHIru9ioHeW4WE2"
# (string)
# usingNoiseReduced "test trigger"


if __name__ == "__main__":
    filename = "acgtr-pretty-darn.wav".strip()
    wav_supported_exts = ['wav', 'flac', 'aiff']
    data = {
        "separationOption": 2,
        "midiOption": True,
        "filetype": "wav",
    }
    filepath = ""
    stem = int(data['separationOption'])
    if stem > 0:
        cmd = []
        model = "htdemucs"
        if data['filetype'] not in wav_supported_exts:
            cmd = ["--mp3"]
        else:
            def get_encoding(sample_width):
                match sample_width:
                    case 3:
                        return "--int24"
                    case 4:
                        return "--float32"
                    case _:
                        return None
            encoding = get_encoding(AudioSegment.from_file(filename).sample_width)
            if encoding:
                cmd.extend(["--wav", f"{encoding}"])
        if stem == 2:
            cmd.extend(["--two-stems", "vocals"])
        elif stem == 6:
            model = "htdemucs_6s"
            cmd.extend(["-n", model])
        cmd.append(filename)
        print(f"Running Demucs with command: {cmd}\n")
        demucs.separate.main(cmd)
        filepath = f"/separated/{model}/{filename}/"


    # separate_audio = input("Do you want to separate the audio? (True/False): ").strip().lower() == 'true'
    # file = AudioSegment.from_file(filename)
    # sample_rate = file.frame_rate
    # sample_width = file.sample_width
    # data['encoding'] = file.sample_width * 8
    # print(f"File: {filename}, Sample Rate: {sample_rate}, Sample Width: {sample_width}, Channels: {file.channels}")

    # if separate_audio == True:
    #     stem = int(input("Enter the number of stems (4 or 6): ").strip())

        # demucs.separate.main(["--mp3", "--two-stems", "vocals", "-n", "mdx_extra", "track with space.mp3"])
        # demucs.separate.main(["--mp3", "--two-stems", "vocals", "-n", "mdx_extra", "track with space.mp3"])
    
    # midi = input("Do you want to generate MIDI? (True/False): ").strip().lower() == 'true'