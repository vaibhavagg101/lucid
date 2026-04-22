FROM python:3.12-slim

WORKDIR /noise-reduce

RUN apt-get update && apt-get install -y ffmpeg gcc

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["python3", "app.py"]