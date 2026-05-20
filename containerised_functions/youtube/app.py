import os
from fastapi import FastAPI, Security, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from yt_dlp import YoutubeDL
from google.cloud import storage
import firebase_admin
from firebase_admin import firestore

API_KEY = os.getenv("YOUTUBE_API_KEY")
if not API_KEY:
    raise RuntimeError("YOUTUBE_API_KEY environment variable missing.")

class YoutubeRequest(BaseModel):
    url: str
    userid: str
    gsBucket: str

app = FastAPI(title="YouTube API - Google Cloud Run")

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

api_key_header = APIKeyHeader(name="X-API-Key")
def get_api_key(api_key:str = Security(api_key_header)):
    if api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API Key")
    return api_key

@app.post("/youtube")
def youtubeUrlToAudio(request: YoutubeRequest, api_key: str = Security(get_api_key)):
    URL = request.url
    USERID = request.userid
    GSBUCKET = request.gsBucket

    if not URL or not USERID or not GSBUCKET:
        raise HTTPException(status_code=400, detail="Missing URL or USERID or GSBUCKET")
    
    if GSBUCKET.startswith("gs://"):
        GSBUCKET = GSBUCKET[5:]

    try:
        with YoutubeDL({'quiet': True, 'no_warnings': True}) as ydl_info:
            info = ydl_info.extract_info(URL, download=False)
            raw_title = info.get('title', 'Unknown_Audio')
            # Clean the title
            audio_name = "".join(c for c in raw_title if c.isalnum() or c in " -_").strip().replace(" ", "_")
            if not audio_name:
                audio_name = "Unknown_Audio"
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch YouTube info: {str(e)}")

    # yt-dlp config: extract best audio and convert to m4a
    ydl_opts = {
        'format': 'm4a/bestaudio/best',
        'outtmpl': f'/tmp/{audio_name}.m4a',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'm4a',
        }],
        'quiet': True,
        'no_warnings': True
    }
    
    temp_filepath = f"/tmp/{audio_name}.m4a"
    
    try:
        with YoutubeDL(ydl_opts) as ydl:
            ydl.download([URL])
        
        if not firebase_admin._apps:
            firebase_admin.initialize_app()
        storage_client = storage.Client()
        bucket = storage_client.bucket(GSBUCKET)

        db = firestore.client()
        audio_files_ref = db.collection('audio_files')
        audioid = audio_files_ref.document().id

        gcs_filepath = f"{USERID}/audio/{audioid}.m4a"
        blob = bucket.blob(gcs_filepath)
        
        blob.upload_from_filename(temp_filepath, content_type="audio/m4a")
        
        audio_files_ref.document(audioid).set({
            "bpm": None,
            "chordProgression": None,
            "filename": audio_name,
            "filepath": gcs_filepath,
            "filetype": "m4a",
            "id": audioid,
            "key": None,
            "noiseReducedFilepath": None,
            "separationOption": 0,
            "uploadedAt": firestore.SERVER_TIMESTAMP,
            "userId": USERID,
            "usingNoiseReduced": False
        })

        signed_url = blob.generate_signed_url(expiration=3600, version='v4', method='GET')

        return {
            "gsBucketURL": signed_url,
            "audioid": audioid
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process YouTube URL: {str(e)}")
    finally:
        if os.path.exists(temp_filepath):
            os.remove(temp_filepath)

if __name__ == '__main__':
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host='0.0.0.0', port=port)