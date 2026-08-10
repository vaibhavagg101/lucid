# FastAPI web service that downloads audio from YouTube video URLs and uploads it to Cloud Storage.
import os
import re
from fastapi import FastAPI, Security, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from yt_dlp import YoutubeDL
from google.cloud import storage
from google.cloud.firestore import Increment
import firebase_admin
import base64
import json
from firebase_admin import firestore

# Sign in to confirm you’re not a bot. 
# Use --cookies-from-browser or --cookies for the authentication. 
# See  https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp  
# for how to manually pass cookies. 
# Also see  https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies  
# for tips on effectively exporting YouTube cookies

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

if not firebase_admin._apps:
    firebase_admin.initialize_app()
db = firestore.client()

@app.post("/youtube")
def youtubeUrlToAudio(request: YoutubeRequest, jobId: str):
    URL = request.url
    USERID = request.userid
    GSBUCKET = request.gsBucket

    if not URL or not USERID or not GSBUCKET or not jobId:
        raise HTTPException(status_code=400, detail="Missing URL, USERID, GSBUCKET, or jobId")

    job_ref = db.collection('jobs').document(jobId)

    if GSBUCKET.startswith("gs://"):
        GSBUCKET = GSBUCKET[5:]

    ydl_info_opts = {'quiet': True, 'no_warnings': True}
    ydl_info_opts['extractor_args'] = {'youtube': ['player_client=android']}

    duration = None
    try:
        with YoutubeDL(ydl_info_opts) as ydl_info:
            info = ydl_info.extract_info(URL, download=False)
            duration = info.get('duration')
            raw_title = info.get('title', 'Unknown_Audio')
            # Clean the title
            audio_name = "".join(c for c in raw_title if c.isalnum() or c in " -_").strip().replace(" ", "_")
            if not audio_name:
                audio_name = "Unknown_Audio"
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch YouTube info: {str(e)}")

    if duration is not None and duration > 600:
        raise HTTPException(status_code=400, detail="Video is longer than 10 minutes")

    # yt-dlp config: extract best audio and convert to m4a
    ydl_opts = {
        'format': 'm4a/bestaudio/best',
        'outtmpl': f'/tmp/{jobId}/{audio_name}.m4a',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'm4a',
        }],
        'quiet': True,
        'no_warnings': True
    }
    
    ydl_opts['extractor_args'] = {'youtube': ['player_client=android']}
    
    temp_filepath = f"/tmp/{jobId}/{audio_name}.m4a"
    
    try:
        os.makedirs(f"/tmp/{jobId}", exist_ok=True)
        with YoutubeDL(ydl_opts) as ydl:
            ydl.download([URL])
        
        if not firebase_admin._apps:
            firebase_admin.initialize_app()
        storage_client = storage.Client()
        bucket = storage_client.bucket(GSBUCKET)

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

        return {
            "filepath": gcs_filepath,
            "audioid": audioid
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process YouTube URL: {str(e)}")
    finally:
        import shutil
        shutil.rmtree(f"/tmp/{jobId}", ignore_errors=True)

class PubSubMessage(BaseModel):
    message: dict

@app.post("/youtube-pubsub")
def youtubeUrlToAudio_pubsub(message: PubSubMessage):
    if "data" not in message.message:
        return {"status": "error", "detail": "Invalid Pub/Sub message format"}
    try:
        data = base64.b64decode(message.message["data"]).decode("utf-8")
        payload = json.loads(data)
    except Exception as e:
        print(f"Error decoding Pub/Sub message: {e}")
        return {"status": "error", "detail": "Failed to decode payload"}
    
    userid = payload.get('userid')
    if not userid or not re.match(r'^[a-zA-Z0-9_-]+$', userid):
        return {"status": "error", "detail": "Invalid or missing userid"}

    jobId = payload.get('jobId')
    if not jobId or not re.match(r'^[a-zA-Z0-9_-]+$', jobId):
        return {"status": "error", "detail": "Invalid or missing jobId"}

    try:
        user_ref = db.collection('users').document(userid)
        user_snapshot = user_ref.get()
        if not user_snapshot.exists:
            return {"status": "error", "detail": "Authentication error: User not found"}
        
        user_doc = user_snapshot.to_dict() or {}
    except Exception as e:
        print(f"Error retrieving user data: {e}")
        return {"status": "error", "detail": "Authentication error: unable to retrieve user data"}

    youtube_uses = user_doc.get('youtubeUses')
    if youtube_uses is None:
        youtube_uses = 0
    if youtube_uses >= 3:
        return {"status": "error", "detail": "Youtube uses exhausted"}

    job_ref = db.collection('jobs').document(jobId)

    try:
        request = YoutubeRequest(
            url=payload.get('url'),
            userid=payload.get('userid'),
            gsBucket=payload.get('gsBucket')
        )

        result = youtubeUrlToAudio(request, jobId)

        job_ref.update({
            "status": "completed",
            "filepath": result['filepath'],
            "audioid": result['audioid']
        })

        user_ref.update({
            "youtubeUses": Increment(1)
        })
    except HTTPException as e:
        job_ref.update({"status": "failed", "error": str(e.detail)})
        print(f"Job {jobId} failed with HTTPException: {e.detail}")
    except Exception as e:
        job_ref.update({"status": "failed", "error": "Internal processing error"})
        print(f"Job {jobId} failed with Error: {e}")

    return {"status": "processed"}

if __name__ == '__main__':
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host='0.0.0.0', port=port)
