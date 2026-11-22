# Antra Flux Gateway

A small FastAPI service that wraps the open-source **Antra** engine
(<https://github.com/anandprtp/Antra>) and exposes it as a clean REST
streaming API for the Antra Flux web platform — and for any music app.

```
music app / browser ──► Cloudflare Pages (site + /api edge functions)
                                   │
                                   ▼ (ANTRA_GATEWAY_URL)
                        Antra Flux Gateway  ◄── this folder
                                   │
                                   ▼
                        Antra engine + your configured sources
```

## Endpoints

| Endpoint | Description |
| --- | --- |
| `GET /health` | Engine status, mode, format/quality settings |
| `GET /search?q=&kind=song|album|artist&limit=&source=apple|spotify` | Catalog search (public APIs — no account needed) |
| `GET /catalog` | Discovery data (Apple top albums) |
| `GET /resolve?url=` | Full metadata for any track/album/playlist link |
| `GET /track/{id}` | Metadata for a search-result id |
| `GET /album/{id}` | Album tracklist for a search-result album id |
| `GET /lyrics/{id}` | Plain text + synced LRC when available |
| `GET /stream/{id}` | Lossless audio bytes (HTTP Range supported, CORS open) |

All responses send `Access-Control-Allow-Origin: *` so browsers and apps can
call the gateway directly.

## Run on your PC

```bash
cd gateway
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
git clone https://github.com/anandprtp/Antra.git Antra
pip install -r Antra/requirements-runtime.txt
python server.py          # listens on :8877
```

Configure your sources the same way you do for the Antra desktop app —
endpoint manifest, Tidal/Qobuz credentials etc. via environment variables
(see Antra's `.env.example`):

```bash
export ANTRA_ENDPOINT_MANIFEST_URL="https://your-manifest-host/manifest/<secret>"
python server.py
```

## Free HTTPS in one command (no port-forwarding)

Cloudflare Tunnel gives the gateway a public HTTPS URL for free:

```bash
cloudflared tunnel --url http://localhost:8877
# → https://<random>.trycloudflare.com
```

Paste that URL into the platform's **Settings** view (per-browser), or set it
as the site-wide default: `ANTRA_GATEWAY_URL` env var on your Cloudflare
Pages project.

## Other free hosting options

- **Hugging Face Spaces** (free, sleeps when idle): create a Space with
  `sdk: docker` and push this folder — the `Dockerfile` works as-is.
- **Render / Railway / Koyeb free tiers**: Docker deploy, same file.
- **A VPS you own**: `docker build -t antra-gateway . && docker run -p 8877:8877 antra-gateway`.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `GATEWAY_HOST` / `GATEWAY_PORT` | `0.0.0.0` / `8877` | Bind address |
| `GATEWAY_API_KEY` | *(empty = open)* | Shared secret; clients send `x-api-key` |
| `ANTRA_REPO_DIR` | `./Antra` | Where the Antra repo is cloned |
| `STREAM_CACHE_DIR` | `./stream-cache` | Downloaded lossless files cache |
| `STREAM_CACHE_MAX_FILES` | `200` | LRU cap for cached files |
| `ANTRA_SEARCH_SOURCE` | `apple` | `apple` or `spotify` |
| `ANTRA_OUTPUT_FORMAT` | `flac` | `flac`, `alac`, `mp3`, `aac` |
| `ANTRA_OUTPUT_QUALITY` | `hires` | `hires`, `lossless`, `high`, `low` |
| plus all Antra engine env vars | — | endpoint manifest, credentials, etc. |

## Security and responsibility notes

- The gateway streams whatever your configured sources resolve. **You** are
  responsible for holding the rights to anything you serve.
- Keep `GATEWAY_API_KEY` set on public hosts — otherwise anyone who finds the
  URL can use your configured sources.
- The gateway serves only audio files it produced from your own source
  configuration; it hosts nothing itself.
