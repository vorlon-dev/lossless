# Antra Flux — Open Streaming Platform (YouTube Music metadata)

An open, high-tech **music streaming platform** wired to a live **YouTube Music
metadata backend**:

- **Web app** — search the full YTM catalog, browse trending tracks / new
  releases / top artists, open albums, read lyrics — with a full player UI
  (queue, seek, volume, shuffle/repeat, lyrics panel, spectrum visualizer).
- **Open REST API** — CORS-enabled endpoints (`/api/search`, `/api/catalog`,
  `/api/track/{id}`, `/api/album/{id}`, `/api/lyrics/{id}`, …) that **any music
  app** can plug into for real metadata.
- **Cloudflare-ready** — deploys free as a single Cloudflare **Workers**
  project (static assets + API Worker). No paid plan needed.
- **Pluggable playback** — metadata comes from your YTM backend; audio playback
  is delegated to the stream resolver you configure (`ANTRA_STREAM_TEMPLATE`).

```
browser / music apps ──► Cloudflare Workers (static assets + /api Worker)
                                    │  ANTRA_GATEWAY_URL (default: your YTM worker)
                                    ▼
                         YTM metadata backend (Cloudflare Worker)
                         /search · /album · /song · /lyrics · /charts …
                                    │  ANTRA_STREAM_TEMPLATE (optional)
                                    ▼
                         your stream resolver (audio bytes)
```

## Repository layout

```
src/app/                 Next.js 16 app (single-page UI + API route handlers)
src/app/api/             /api/* handlers for local dev / Node hosting
src/lib/api-core.ts      Shared API logic (used by Worker, Pages Functions & Next routes)
src/lib/ytm.ts           YTM backend → Flux catalog normalizers (shared server/client)
src/components/flux/     UI: hero, search, player, queue, lyrics, docs, settings
worker/index.ts          Cloudflare Worker entry (production /api/* + assets)
functions/api/[[path]].ts  Legacy Cloudflare Pages Function (same shared core)
gateway/                 Optional Python FastAPI gateway (kept from the Antra base)
scripts/export-static.sh Builds the static export (out/) for Cloudflare
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

Environment (all optional — sane defaults are built in):

| Variable | Purpose |
| --- | --- |
| `ANTRA_GATEWAY_URL` | Base URL of your YTM metadata backend. Defaults to `https://ytm-backend.vorlon-revora.workers.dev` |
| `ANTRA_API_KEY` | Optional shared secret (clients send `x-api-key` header or `?key=`) |
| `ANTRA_STREAM_TEMPLATE` | Optional playback resolver URL containing `{id}` — e.g. `https://your-resolver.example/stream/{id}` |

## Deploy (Cloudflare, free)

See [README-DEPLOY.md](README-DEPLOY.md). In short:

```bash
bash scripts/export-static.sh
npx wrangler deploy
```

The metadata backend URL can be set site-wide via `ANTRA_GATEWAY_URL`
(wrangler secret or dashboard env var), or per-browser in the Settings view.

## The public API (for your music apps)

```
GET /api/status           service status + backend health + capabilities
GET /api/search           q, kind=song|album|artist|all, limit (1–50)
GET /api/suggestions      search autocomplete (?q=)
GET /api/catalog          trending + new releases + top artists (?region=)
GET /api/track/{id}       full track metadata + queue context + lyrics
GET /api/album/{id}       album + ordered tracklist
GET /api/playlist/{id}    playlist tracks (?cursor= for infinite scroll)
GET /api/artist/{id}      artist page: top tracks, albums, singles, videos
GET /api/related/{id}     related tracks for a song
GET /api/radio/{id}       infinite radio queue (?cursor=)
GET /api/lyrics/{id}      plain text lyrics (+ synced when available)
GET /api/stream/{id}      audio playback — 302 to ANTRA_STREAM_TEMPLATE (unset → 502)
```

Track ids are **YouTube video ids** (`4NRXx6U8ABQ`), album ids are **MPREb_…
browse ids**, artist ids are **UC… channel ids** — the exact ids your YTM
backend already uses, so third-party apps can move between metadata and
playback without translation.

```bash
curl "https://your-site.workers.dev/api/search?q=blinding%20lights&kind=song"
curl "https://your-site.workers.dev/api/track/4NRXx6U8ABQ"
curl -L "https://your-site.workers.dev/api/stream/4NRXx6U8ABQ" -o track.audio
```

The site's **API** view shows copy-paste examples for curl / Python /
JavaScript / generic players (M3U, mpv, VLC, Symfonium, Feishin…).

## Legal

This platform hosts no copyrighted media. Metadata is sourced from the backend
you configure; audio playback is delegated to the resolver you configure. You
are responsible for holding the rights to anything you stream through it.
