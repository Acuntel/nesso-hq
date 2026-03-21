FROM python:3.11-slim

# Install FFmpeg + fonts (DejaVu for text rendering on Linux)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Ensure tmp dir exists
RUN mkdir -p /app/tmp

CMD ["python", "main.py"]
