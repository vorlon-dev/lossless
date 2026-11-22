# Antra Flux — Hi-Res Lossless Streaming Platform

An open, high-tech **lossless streaming platform** built on top of the
[Antra](https://github.com/anandprtp/Antra) engine:

- **Web app** — search, browse and stream FLAC/ALAC in the browser with a full
  player (queue, seek, volume, shuffle/repeat, synced lyrics, spectrum
  visualizer, hi-res quality badges).
- **Open REST API** — CORS-enabled, HTTP-Range-aware endpoints
  (`/api/search`, `/api/stream/{id}`, …) that **any music app** can plug into.
- **Cloudflare-ready** — deploys free as a single Cloudflare **Workers**
  project (static assets + API Worker). No paid plan needed.
- **Antra gateway** — a small Python service (`gateway/`) that wraps the
  actual Antra engine for catalog search, metadata and lossless stream
  resolution, hosted on your PC / VPS / any free Python host.

```
browser / music apps ──► Cloudflare Workers (static assets + /api Worker)
                                    │  ANTRA_GATEWAY_URL
                                    ▼
                         Antra Flux Gateway (Python, /gateway)
                                    │
                                    ▼
                         Antra engine + your configured sources
```

> Until you connect a gateway, the entire site **and every API endpoint**
> serve a built-in original demo catalog (10 synthesized FLAC tracks +
> procedurally generated cover art), so everything works out of the box.

## Repository layout

```
src/app/                 Next.js 16 app (single-page UI + API route handlers)
src/app/api/             /api/* handlers for local dev / Node hosting
src/lib/api-core.ts      Shared API logic (used by BOTH Next routes & CF Functions)
src/lib/demo-catalog.ts  Built-in demo catalog
src/components/flux/     UI: hero, search, player, queue, lyrics, docs, settings
worker/index.ts          Cloudflare Worker entry (production /api/* + assets)
functions/api/[[path]].ts  Legacy Cloudflare Pages Function (same shared core)
gateway/                 Python FastAPI gateway wrapping the Antra engine
scripts/export-static.sh Builds the static export (out/) for Cloudflare
scripts/gen_demo_assets.py  Regenerates demo media (needs numpy, Pillow, ffmpeg)
wrangler.toml            Cloudflare Workers config (site + API Worker)
README-DEPLOY.md         Step-by-step Cloudflare deployment guide
```

## Local development

```bash
bun install          # or: npm install
bun run dev          # http://localhost:3000   (or: npm run dev)
bun run lint
```

No Bun? Everything also works with plain Node.js + npm — including the
Cloudflare build (`bash scripts/export-static.sh` auto-falls back to npx).

Environment (copy `.env.example` → `.env` if you want live mode locally):

| Variable | Purpose |
| --- | --- |
| `ANTRA_GATEWAY_URL` | Base URL of your Antra gateway → flips `/api/*` to live mode |
| `ANTRA_API_KEY` | Optional shared secret (clients send `x-api-key`) |

## Deploy (Cloudflare, free)

See [README-DEPLOY.md](README-DEPLOY.md). In short:

```bash
bash scripts/export-static.sh
npx wrangler deploy
```

Then run the audio gateway somewhere Python lives and point the platform at
it (env var for site-wide, or Settings view per-browser).

## The public API (for your music apps)

```
GET /api/status          service status + capability list
GET /api/search          q, kind=song|album|artist, limit (1–50)
GET /api/catalog         everything indexed
GET /api/track/{id}      full metadata (format, quality, ISRC, artwork)
GET /api/album/{id}      album + ordered tracklist
GET /api/stream/{id}     lossless audio bytes (Range supported, CORS open)
GET /api/lyrics/{id}     plain text + synced LRC
```

```bash
curl "https://your-site.pages.dev/api/search?q=aurora&kind=song"
curl -L "https://your-site.pages.dev/api/stream/<id>" -o track.flac
mpv "https://your-site.pages.dev/api/stream/<id>"
```

The site's **API** view shows copy-paste examples for curl / Python /
JavaScript / generic players (M3U, mpv, VLC, Symfonium, Feishin…).

## Legal

This platform hosts no copyrighted media. It streams only what **your**
gateway and **your** configured sources resolve — you are responsible for
holding the rights to anything you serve. The bundled demo catalog is
original, synthesized audio created for this project. Antra itself is used
under its own license (educational/research purposes — see its repository).
