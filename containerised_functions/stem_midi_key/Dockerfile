FROM python:3.14-slim

ENV PYTHONUNBUFFERED=True

WORKDIR /app

RUN apt-get update && apt-get install -y ffmpeg gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download model weights into the image so runtime never hits the network
ENV HF_HOME=/app/.cache/huggingface
RUN python -c "from demucs.pretrained import get_model; get_model('htdemucs')"
RUN python -c "from demucs.pretrained import get_model; get_model('htdemucs_6s')"

COPY app.py .

# Create a non-root user and switch to it for better security: Suggested by Gemini AI
RUN useradd -m appuser
USER appuser

CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8080}"]