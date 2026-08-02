FROM python:3.14-slim

ENV PYTHONUNBUFFERED=True

WORKDIR /app

RUN apt-get update && apt-get install -y ffmpeg gcc git && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY ISMIR2019-Large-Vocabulary-Chord-Recognition/ ISMIR2019-Large-Vocabulary-Chord-Recognition/
COPY app.py .
COPY key_detection.py .

CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8080}"]
