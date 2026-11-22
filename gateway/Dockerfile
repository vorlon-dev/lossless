# Antra Flux Gateway — wraps the open Antra engine as a streaming API.
# Build:  docker build -t antra-gateway .
# Run:    docker run -p 8877:8877 -v gateway-cache:/app/stream-cache antra-gateway
FROM python:3.12-slim

WORKDIR /app

# ffmpeg is used by the engine for transcoding/verification
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg git \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Clone the Antra engine (pinned at build time; rebuild for updates)
ARG ANTRA_REPO=https://github.com/anandprtp/Antra.git
RUN git clone --depth 1 ${ANTRA_REPO} /app/Antra \
    && pip install --no-cache-dir -r /app/Antra/requirements-runtime.txt || true

COPY server.py .

ENV GATEWAY_HOST=0.0.0.0 \
    GATEWAY_PORT=8877 \
    ANTRA_REPO_DIR=/app/Antra \
    STREAM_CACHE_DIR=/app/stream-cache

EXPOSE 8877
VOLUME /app/stream-cache

CMD ["python", "server.py"]
