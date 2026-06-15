FROM python:3.12-slim

ENV PYTHONUNBUFFERED=True

WORKDIR /app

RUN apt-get update && apt-get install -y ffmpeg gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

# Create a non-root user and switch to it for better security: Suggested by Gemini AI
RUN useradd -m appuser
USER appuser

CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8080}"]