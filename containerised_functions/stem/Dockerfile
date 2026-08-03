FROM python:3.14-slim

ENV PYTHONUNBUFFERED=True

WORKDIR /app

RUN apt-get update && apt-get install -y ffmpeg gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

# Create a non-root user and switch to it for better security
RUN useradd -m appuser && \
    mkdir -p /app/.cache && \
    chown -R appuser:appuser /app

USER appuser

# Pre-download model weights into the image so runtime never hits the network
# Do this as appuser so the files are owned and accessible at runtime
ENV HF_HOME=/app/.cache/huggingface
ENV TORCH_HOME=/app/.cache/torch

RUN python -c "from demucs.pretrained import get_model; get_model('htdemucs')"
RUN python -c "from demucs.pretrained import get_model; get_model('htdemucs_6s')"

CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8080}"]