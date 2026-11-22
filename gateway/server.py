#!/usr/bin/env python3
"""
Antra Flux Gateway — REST wrapper around the open Antra engine.

Exposes the endpoints the Antra Flux web platform (and any music app) needs:
    GET /health            → service + engine status
    GET /search            → catalog search (Apple/Spotify public APIs, no login)
    GET /catalog           → discovery data (top albums)
    GET /resolve?url=      → full metadata for any track/album/playlist link
    GET /track/{id}        → cached metadata for a search result
    GET /album/{id}        → cached album tracklist
    GET /lyrics/{id}       → plain + synced LRC when available
    GET /stream/{id}       → lossless audio bytes (HTTP Range supported)

How streaming works
-------------------
1. /search caches every result row (id → source URL).
2. /stream/{id} re-resolves the row through the Antra engine (metadata →
   source match → lossless download into a local cache) and serves the file
   with Range support. First play resolves (a few seconds); replays are instant.
3. Which qualities you actually get depends on the sources configured for
   Antra (see ANTRA_ENDPOINT_MANIFEST_URL in Antra's .env.example).

Run anywhere Python runs — your PC, a VPS, or a free Python host:

    pip install -r requirements.txt
    git clone https://github.com/anandprtp/Antra.git Antra
    pip install -r Antra/requirements-runtime.txt
    python server.py                     # or: uvicorn server:app --port 8877

Then point the platform at it (Settings view, or set ANTRA_GATEWAY_URL on
your Cloudflare deployment). CORS is fully open so browsers and apps connect
directly.
"""
from __future__ import annotations

import json
import logging
import os
import re
import sys
import time
from dataclasses import asdict
from pathlib import Path
from typing import Any, Optional
from urllib.parse import unquote

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# ─── configuration ───────────────────────────────────────────────────────────
HOST = os.environ.get("GATEWAY_HOST", "0.0.0.0")
PORT = int(os.environ.get("GATEWAY_PORT", "8877"))
API_KEY = os.environ.get("GATEWAY_API_KEY", "").strip()  # optional shared secret
ANTRA_DIR = Path(os.environ.get("ANTRA_REPO_DIR", Path(__file__).parent / "Antra"))
CACHE_DIR = Path(os.environ.get("STREAM_CACHE_DIR", Path(__file__).parent / "stream-cache"))
CACHE_MAX_FILES = int(os.environ.get("STREAM_CACHE_MAX_FILES", "200"))
SOURCE_PREFERENCE = os.environ.get("ANTRA_SEARCH_SOURCE", "apple")  # "apple" | "spotify"
DOWNLOAD_FORMAT = os.environ.get("ANTRA_OUTPUT_FORMAT", "flac")  # flac | alac | mp3 | aac
DOWNLOAD_QUALITY = os.environ.get("ANTRA_OUTPUT_QUALITY", "hires")  # hires | lossless | high | low

logging.basicConfig(level=os.environ.get("GATEWAY_LOG_LEVEL", "INFO"),
                    format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("antra-gateway")

# ─── engine bootstrap ────────────────────────────────────────────────────────
ENGINE_OK = False
ENGINE_ERROR: Optional[str] = None

def _bootstrap_engine() -> None:
    """Import the Antra package from the cloned repo next to this file."""
    global ENGINE_OK, ENGINE_ERROR
    if ENGINE_OK:
        return
    if not ANTRA_DIR.exists():
        ENGINE_ERROR = (
            f"Antra repo not found at {ANTRA_DIR}. "
            "Run: git clone https://github.com/anandprtp/Antra.git Antra"
        )
        log.warning(ENGINE_ERROR)
        return
    sys.path.insert(0, str(ANTRA_DIR))
    try:
        from antra.core.service import AntraService  # noqa: F401
        from antra.core.config import load_config   # noqa: F401
        ENGINE_OK = True
        log.info("Antra engine loaded from %s", ANTRA_DIR)
    except Exception as e:  # pragma: no cover
        ENGINE_ERROR = f"Antra import failed: {e}"
        log.exception(ENGINE_ERROR)

_bootstrap_engine()

def get_service():
    """Build an AntraService with this gateway's output settings."""
    if not ENGINE_OK:
        raise HTTPException(
            status_code=503,
            detail={"error": "engine_unavailable", "hint": ENGINE_ERROR or "engine failed to load"},
        )
    from antra.core.config import load_config
    from antra.core.service import AntraService
    cfg = load_config()
    cfg.output_dir = str(CACHE_DIR)
    cfg.output_format = DOWNLOAD_FORMAT
    cfg.output_quality = DOWNLOAD_QUALITY
    return AntraService(config=cfg)

# ─── in-memory registries ────────────────────────────────────────────────────
_rows: dict[str, dict[str, Any]] = {}
_meta: dict[str, dict[str, Any]] = {}
MAX_REGISTRY = 2000

def remember(kind: str, key: str, value: dict[str, Any]) -> None:
    store = _rows if kind == "row" else _meta
    if len(store) > MAX_REGISTRY:
        store.clear()
    store[key] = value

def row_for(track_id: str) -> dict[str, Any]:
    row = _rows.get(track_id)
    if not row:
        raise HTTPException(
            404,
            detail={"error": "unknown_id",
                    "hint": "The id must come from this gateway's /search results."},
        )
    return row

def meta_for(track_id: str) -> dict[str, Any]:
    return _meta.get(track_id, {})

# ─── normalization (same contract as the platform's /api core) ───────────────
def normalize_row(row: dict[str, Any], idx: int = 0) -> dict[str, Any]:
    tid = str(row.get("id") or row.get("stream_id") or f"row-{idx}-{abs(hash(str(row))) % 99999}")
    remember("row", tid, row)
    artists_raw = row.get("artists") or ""
    artists = ([a.strip() for a in artists_raw.split(",")]
               if isinstance(artists_raw, str) else (artists_raw or []))
    fmt = (row.get("audio_format") or "").upper()
    bit_depth = row.get("bit_depth")
    sample_rate = row.get("sample_rate_hz")
    quality_known = bool(fmt)
    return {
        "id": tid,
        "title": row.get("title") or "Unknown",
        "artists": artists,
        "album": row.get("album") or "",
        "albumId": row.get("album_id"),
        "durationMs": row.get("duration_ms") or 0,
        "trackNumber": row.get("track_number"),
        "releaseYear": row.get("year") or row.get("release_year"),
        "artworkUrl": row.get("artwork_url"),
        "explicit": row.get("is_explicit"),
        "format": {
            "codec": fmt or "",
            "bitDepth": bit_depth,
            "sampleRateHz": sample_rate,
            "lossless": quality_known and fmt in ("FLAC", "ALAC"),
        },
        "qualityLabel": (
            (f"{fmt} {bit_depth}-bit/{round(sample_rate / 1000)}kHz"
             if bit_depth and sample_rate else fmt) if fmt
            else f"lossless via {row.get('source') or 'source'}"
        ),
        "hiRes": bool(quality_known and ((bit_depth and bit_depth >= 24) or (sample_rate and sample_rate > 48000))),
        "streamUrl": f"/stream/{tid}",
        "source": row.get("source"),
        "sourceUrl": row.get("url"),
    }

def track_payload(meta: dict[str, Any]) -> dict[str, Any]:
    """TrackMetadata(asdict) → platform Track shape."""
    tid = str(meta.get("spotify_id") or meta.get("apple_music_id") or meta.get("isrc")
              or abs(hash(json.dumps(meta, sort_keys=True, default=str))) % 999999)
    artists = meta.get("artists") or []
    return {
        "id": tid,
        "title": meta.get("title") or "",
        "artists": artists if isinstance(artists, list) else [str(artists)],
        "album": meta.get("album") or "",
        "albumId": meta.get("album_id"),
        "durationMs": meta.get("duration_ms") or 0,
        "trackNumber": meta.get("track_number"),
        "discNumber": meta.get("disc_number"),
        "releaseYear": meta.get("release_year"),
        "genres": meta.get("genres") or [],
        "artworkUrl": meta.get("artwork_url"),
        "isrc": meta.get("isrc"),
        "explicit": meta.get("is_explicit"),
        "format": {"codec": DOWNLOAD_FORMAT.upper(), "lossless": DOWNLOAD_FORMAT.lower() in ("flac", "alac")},
        "qualityLabel": DOWNLOAD_FORMAT.upper(),
        "hiRes": False,
        "streamUrl": f"/stream/{tid}",
        "source": meta.get("source_service"),
        "lyrics": {"plain": meta.get("lyrics") or "", "syncedLrc": meta.get("synced_lyrics") or ""},
    }

# ─── app ─────────────────────────────────────────────────────────────────────
app = FastAPI(title="Antra Flux Gateway", version="1.0.0",
              description="REST streaming gateway wrapping the open Antra engine.")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "HEAD", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Range", "Accept-Ranges", "Content-Length", "Content-Type"],
)

RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)")
_current_range: dict[str, Optional[str]] = {"value": None}

@app.middleware("http")
async def capture_range(request: Request, call_next):
    _current_range["value"] = request.headers.get("range")
    return await call_next(request)

@app.middleware("http")
async def api_key_guard(request: Request, call_next):
    if API_KEY:
        provided = request.headers.get("x-api-key") or request.query_params.get("key") or ""
        if provided != API_KEY:
            return JSONResponse({"error": "unauthorized", "detail": "send header x-api-key"}, status_code=401)
    return await call_next(request)

MEDIA_TYPES = {
    ".flac": "audio/flac",
    ".m4a": "audio/mp4",
    ".mp3": "audio/mpeg",
    ".aac": "audio/aac",
    ".opus": "audio/ogg",
}

def ranged_file_response(path: Path, media_type: str) -> Response:
    """Serve a file with HTTP Range support (needed for seeking)."""
    size = path.stat().st_size
    start, end = 0, size - 1
    request_range = _current_range["value"]
    status = 200
    if request_range:
        m = RANGE_RE.match(request_range.strip())
        if m:
            if m.group(1):
                start = int(m.group(1))
            if m.group(2):
                end = min(int(m.group(2)), size - 1)
    length = max(0, end - start + 1)
    if start >= size or length <= 0:
        return Response(status_code=416, headers={"Content-Range": f"bytes */{size}"})
    headers = {"Accept-Ranges": "bytes", "Content-Length": str(length),
               "Cache-Control": "public, max-age=3600"}
    if request_range and (start > 0 or end < size - 1):
        status = 206
        headers["Content-Range"] = f"bytes {start}-{end}/{size}"

    if length > 4 * 1024 * 1024:
        def iter_file():
            with open(path, "rb") as fh:
                fh.seek(start)
                remaining = length
                while remaining > 0:
                    chunk = fh.read(min(512 * 1024, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk
        return Response(content=iter_file(), media_type=media_type, status_code=status, headers=headers)

    with open(path, "rb") as fh:
        fh.seek(start)
        data = fh.read(length)
    return Response(content=data, media_type=media_type, status_code=status, headers=headers)

def prune_cache() -> None:
    files = [p for p in CACHE_DIR.rglob("*") if p.is_file()]
    files.sort(key=lambda p: p.stat().st_mtime)
    while len(files) > CACHE_MAX_FILES:
        try:
            files[0].unlink()
        except OSError:
            pass
        files.pop(0)

# ─── endpoints ───────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "antra-flux-gateway",
        "version": "1.0.0",
        "engine": "Antra (Python)" if ENGINE_OK else None,
        "mode": "live" if ENGINE_OK else "engine-missing",
        "engineHint": ENGINE_ERROR,
        "format": DOWNLOAD_FORMAT,
        "quality": DOWNLOAD_QUALITY,
        "searchSource": SOURCE_PREFERENCE,
    }

@app.get("/search")
def search(
    q: str = Query("", alias="q"),
    kind: str = Query("song", pattern="^(song|album|artist)$"),
    limit: int = Query(25, ge=1, le=50),
    source: str = Query(SOURCE_PREFERENCE, pattern="^(apple|spotify)$"),
):
    started = time.time()
    if not q.strip():
        return {"query": q, "kind": kind, "results": {"tracks": [], "albums": [], "artists": []}}
    svc = get_service()
    rows = svc.search_catalog(q.strip(), kind=kind, source=source, limit=limit) or []
    normalized = [normalize_row(r, i) for i, r in enumerate(rows)]
    if kind == "artist":
        results = {"tracks": [], "albums": [], "artists": [
            {"id": r["id"], "name": r["title"], "artworkUrl": r["artworkUrl"]} for r in normalized
        ]}
    elif kind == "album":
        results = {"tracks": [], "albums": [{
            "id": r["id"], "title": r["title"], "artists": r["artists"],
            "year": r["releaseYear"], "artworkUrl": r["artworkUrl"],
            "trackCount": 0, "tracks": [],
        } for r in normalized]}
    else:
        results = {"tracks": normalized, "albums": [], "artists": []}
    return {"query": q, "kind": kind, "tookMs": int((time.time() - started) * 1000), "results": results}

@app.get("/catalog")
def catalog():
    """Discovery data (Apple top albums) — best effort."""
    try:
        from antra.core.discovery import AppleDiscovery
        data = AppleDiscovery().get_discovery_data(storefront=os.environ.get("ANTRA_STOREFRONT", "us"))
    except Exception as e:
        raise HTTPException(502, detail=f"discovery unavailable: {e}")
    albums = []
    for i, a in enumerate((data.get("top_albums") or [])[:30]):
        norm = normalize_row({**a, "kind": "album"}, i)
        albums.append({
            "id": norm["id"], "title": norm["title"], "artists": norm["artists"],
            "year": norm["releaseYear"], "artworkUrl": norm["artworkUrl"],
            "trackCount": 0, "tracks": [],
        })
    return {"albums": albums, "artists": [], "tracks": []}

@app.get("/resolve")
def resolve(url: str = Query(..., alias="url")):
    """Full metadata for any track/album/playlist link the Antra engine understands."""
    svc = get_service()
    try:
        from antra.core.service import RuntimeOptions
        options = RuntimeOptions()
        tracks = svc.fetch_playlist_tracks(url.strip(), options=options, enrich_override=False)
    except Exception as e:
        raise HTTPException(502, detail=f"resolve failed: {e}")
    if not tracks:
        raise HTTPException(404, detail="no tracks resolved from that link")
    payloads = []
    for t in tracks:
        meta = asdict(t)
        payload = track_payload(meta)
        remember("meta", payload["id"], meta)
        payloads.append(payload)
    return {"url": url, "count": len(payloads), "tracks": payloads}

@app.get("/track/{track_id}")
def track(track_id: str):
    tid = unquote(track_id)
    row = row_for(tid)
    meta = meta_for(tid)
    if meta:
        return track_payload(meta)
    svc = get_service()
    try:
        from antra.core.service import RuntimeOptions
        tracks = svc.fetch_playlist_tracks(row.get("url"), options=RuntimeOptions(), enrich_override=False)
        if tracks:
            meta = asdict(tracks[0])
            remember("meta", tid, meta)
            return track_payload(meta)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, detail=f"track resolve failed: {e}")
    return normalize_row(row)

@app.get("/album/{album_id}")
def album(album_id: str):
    aid = unquote(album_id)
    row = row_for(aid)
    svc = get_service()
    try:
        from antra.core.service import RuntimeOptions
        tracks = svc.fetch_playlist_tracks(row.get("url"), options=RuntimeOptions(), enrich_override=False)
    except Exception as e:
        raise HTTPException(502, detail=f"album resolve failed: {e}")
    items = []
    for t in tracks or []:
        meta = asdict(t)
        payload = track_payload(meta)
        remember("meta", payload["id"], meta)
        items.append(payload)
    return {
        "id": aid,
        "title": row.get("album") or row.get("title") or "Album",
        "artists": row.get("artists") or [],
        "year": row.get("year"),
        "artworkUrl": row.get("artwork_url"),
        "trackCount": len(items),
        "tracks": items,
    }

@app.get("/lyrics/{track_id}")
def lyrics(track_id: str):
    tid = unquote(track_id)
    meta = meta_for(tid)
    if not meta:
        try:
            track(tid)  # fills _meta
            meta = meta_for(tid)
        except HTTPException:
            meta = {}
    return {
        "trackId": tid,
        "plain": meta.get("lyrics") or "",
        "syncedLrc": meta.get("synced_lyrics") or "",
        "hasSynced": bool(meta.get("synced_lyrics")),
    }

@app.get("/stream/{track_id}")
def stream(track_id: str):
    """Lossless audio for a search-result id (Range supported).

    Resolution chain: cached row → metadata resolve → engine download into the
    stream cache → serve bytes. First play takes a few seconds; replays instant.
    """
    tid = unquote(track_id)
    row = row_for(tid)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    existing = [p for p in CACHE_DIR.rglob("*")
                if p.is_file() and p.suffix.lower() in MEDIA_TYPES
                and tid in str(p)]
    if existing:
        f = max(existing, key=lambda p: p.stat().st_mtime)
        return ranged_file_response(f, MEDIA_TYPES.get(f.suffix.lower(), "audio/flac"))

    if not ENGINE_OK:
        raise HTTPException(503, detail={
            "error": "engine_unavailable",
            "hint": ENGINE_ERROR or "streaming requires the Antra engine and your configured sources",
        })

    svc = get_service()
    try:
        from antra.core.service import RuntimeOptions
        options = RuntimeOptions()
        tracks = svc.fetch_playlist_tracks(row.get("url"), options=options, enrich_override=False)
        if not tracks:
            raise HTTPException(404, detail="track could not be resolved from its source URL")
        meta = asdict(tracks[0])
        remember("meta", tid, meta)
        tracks[0].row_id = tid  # so download results can be correlated

        svc.download_tracks(tracks[:1], options=options)

        produced = [p for p in CACHE_DIR.rglob("*")
                    if p.is_file() and p.suffix.lower() in MEDIA_TYPES
                    and time.time() - p.stat().st_mtime < 600]
        if not produced:
            raise HTTPException(502, detail={
                "error": "download_failed",
                "hint": "no source produced a file — check Antra's mirror/endpoint configuration "
                        "(ANTRA_ENDPOINT_MANIFEST_URL) and source credentials",
            })
        prune_cache()
        f = max(produced, key=lambda p: p.stat().st_mtime)
        return ranged_file_response(f, MEDIA_TYPES.get(f.suffix.lower(), "audio/flac"))
    except HTTPException:
        raise
    except Exception as e:
        log.exception("stream failed for %s", tid)
        raise HTTPException(500, detail=f"stream error: {e}")

if __name__ == "__main__":
    import uvicorn
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    uvicorn.run(app, host=HOST, port=PORT)
