import base64
import json
from pydantic import BaseModel
import demucs.separate

app = FastAPI(title="Noisereduce API - Google Cloud Run")

# Initialize Firebase Admin
if not firebase_admin._apps:
    firebase_admin.initialize_app()
db = firestore.client()

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

def separateTracks():
    

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
    # stem - 4 or 6 is seaparated_audio is true else None
    # midi - true or false

    separate_audio: bool = payload.get('separated_audio')
    stem: Optional[int] = 0
    if separate_audio:
        stem = payload.get('stem')
    generate_stems()
    midi: bool = payload.get('midi')

    try:
        separateTracks()
    except:
        




demucs.separate.main(["--mp3", "--two-stems", "vocals", "-n", "mdx_extra", "track with space.mp3"])
demucs.separate.main(["--mp3", "--two-stems", "vocals", "-n", "mdx_extra", "track with space.mp3"])