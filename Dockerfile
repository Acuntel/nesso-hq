FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    NODE_VERSION=20.x \
    REMOTION_PORT=3100 \
    REMOTION_SERVER_URL=http://localhost:3100

# System deps: ffmpeg, fonts, + Chromium runtime libs for Remotion headless render
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates curl gnupg \
        ffmpeg fonts-dejavu-core fonts-liberation fonts-noto-color-emoji \
        libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
        libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
        libgbm1 libpango-1.0-0 libcairo2 libasound2 libatspi2.0-0 \
        libxshmfence1 && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Node deps for Remotion server — install before source for caching
COPY remotion-reveal/package.json remotion-reveal/package-lock.json* ./remotion-reveal/
RUN cd remotion-reveal && npm install

# Copy source
COPY . .

# Make sure the Nesso logo is inside remotion's public/ so staticFile() resolves it
RUN mkdir -p remotion-reveal/public && \
    cp assets/nesso_logo.png remotion-reveal/public/nesso_logo.png || true

# Build the SFX library at image build time (requires ffmpeg, installed above)
RUN python scripts/build_sfx.py || echo "WARN: sfx build failed — videos will render without sfx layer"

RUN mkdir -p /app/tmp

# entrypoint starts Remotion server in background, then Python bot
RUN chmod +x entrypoint.sh

CMD ["/app/entrypoint.sh"]
