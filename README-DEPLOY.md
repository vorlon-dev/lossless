# Deploying Antra Flux on Cloudflare — free tier

The project splits cleanly along Cloudflare's free-tier capabilities:

```
Cloudflare Workers (free)                    Your Cloudflare account
┌──────────────────────────────────┐         ┌─────────────────────────────┐
│  out/    → static site (assets)  │         │  YTM metadata backend        │
│  worker/ → /api/* Worker         │ ──────► │  (your own Worker project —  │
│          unlimited asset reqs,   │         │   /search /album /song …)    │
│          100k API calls/day      │         └─────────────────────────────┘
└──────────────────────────────────┘
                    │ ANTRA_STREAM_TEMPLATE (optional)
                    ▼
         your stream resolver (audio bytes for /api/stream/{id})
```

Cloudflare's free tier runs the **site + public API as one Workers project**
(static assets + a tiny API Worker). Metadata comes live from your YouTube
Music backend worker; audio playback is delegated to whatever resolver you
configure. No bundled media, no demo catalog — the site is data-driven from
the first request.

---

## 1) Build the static site

```bash
bash scripts/export-static.sh
```

This parks the Next.js API route handlers, builds a fully static export into
`out/`, and restores the handlers. The production `/api/*` endpoints come
from `worker/index.ts` + the shared core (`src/lib/api-core.ts`).

## 2) Deploy to Cloudflare (pick one)

### Option A — Wrangler CLI (quickest)

```bash
bash scripts/export-static.sh
npx wrangler deploy
```

That's it — one command. Wrangler reads `wrangler.toml`, uploads the static
site (`out/`) and the API Worker (`worker/index.ts`) as a single project, and
prints your URL: `https://antra-flux.<your-subdomain>.workers.dev`.

First run opens a browser for `wrangler login` (or set `CLOUDFLARE_API_TOKEN`).

### Option B — Git integration (auto-deploys on push)

1. Push this repo to GitHub.
2. Cloudflare dashboard → **Workers & Pages → Create → Workers → Connect to Git**
   → select the repo.
3. In the build settings:
   - **Build command**: `bash scripts/export-static.sh`
   - **Deploy command**: `npx wrangler deploy` (the default — leave as is)
   - Root directory: repo root (leave default)
4. Save & deploy. Every push to your main branch redeploys automatically;
   other branches create preview URLs.

### Option C — Dashboard drag-and-drop (static only)

Works for the UI **without** the API (drag `out/` into Workers & Pages →
Upload assets). Use A or B if you want the `/api` endpoints.

> Prefer classic Pages? The legacy `functions/api/[[path]].ts` Pages Function
> still ships in this repo: connect the repo to **Cloudflare Pages** instead
> (build command `bash scripts/export-static.sh`, output `out`) and the same
> shared API core runs as a Pages Function. Workers (above) is the recommended,
> current path.

## 3) Environment variables (all optional, site-wide)

Dashboard → your Worker → **Settings → Variables and Secrets**:

| Variable | Meaning |
| --- | --- |
| `ANTRA_GATEWAY_URL` | Base URL of your YTM metadata backend. **Default: `https://ytm-backend.vorlon-revora.workers.dev`** — set it to point at a different backend |
| `ANTRA_API_KEY` | Optional shared secret; clients must send `x-api-key: <key>` |
| `ANTRA_STREAM_TEMPLATE` | Optional playback resolver, e.g. `https://your-resolver.example/stream/{id}`. `{id}` is replaced with the YouTube video id per request. Unset → `/api/stream/{id}` returns 502 with a clear message |

(With wrangler: `npx wrangler secret put ANTRA_GATEWAY_URL`. Or uncomment
them in `wrangler.toml` `[vars]` for non-secret values.)

## 4) Enable playback (optional)

The API is metadata-only until you configure a resolver. Any HTTP audio
source works — point `ANTRA_STREAM_TEMPLATE` at it and `/api/stream/{id}`
will 302-redirect browsers and apps to the audio bytes with the track id
filled in:

```toml
# wrangler.toml [vars] (non-secret) or wrangler secret put
[vars]
ANTRA_STREAM_TEMPLATE = "https://your-resolver.example/stream/{id}"
```

Your YTM backend also exposes `/batch`, `/radio/{id}` and `/related/{id}` —
this API mirrors them (`/api/radio/{id}`, `/api/related/{id}`) so apps can
build queues without touching the backend directly.

## 5) Point your music apps at it

See the **API** view on the site (or `GET /api/status`) for the live endpoint
list and copy-paste examples for curl / Python / JS / generic players. The
API is CORS-open; the stream redirect works with mpv, VLC, Feishin,
Symfonium, custom apps — anything that follows redirects and plays HTTP audio.

```bash
curl "https://antra-flux.<your-subdomain>.workers.dev/api/search?q=blinding%20lights&kind=song"
curl "https://antra-flux.<your-subdomain>.workers.dev/api/track/4NRXx6U8ABQ"
curl -L "https://antra-flux.<your-subdomain>.workers.dev/api/stream/4NRXx6U8ABQ" -o track.audio
```

---

## Costs (free tier)

- **Workers assets**: unlimited static requests, free. Audio bytes served via
  the 302 redirect are plain asset requests — not Worker invocations.
- **Worker**: only `/api/*` calls count — 100k requests/day free.
- **Metadata backend**: your own worker (also free-tier sized, with caching).

## Troubleshooting

**`✘ [ERROR] Missing entry-point to Worker script or to assets directory`**
You ran `wrangler deploy` while `wrangler.toml` was still the old Pages
format (`pages_build_output_dir`). This repo now ships the Workers format —
pull the latest version, rebuild (`bash scripts/export-static.sh`) and run
`npx wrangler deploy` again. The warning
`"wrangler deploy" on a Pages project … use "wrangler pages deploy"` has the
same cause and is fixed by the same update.

**`✘ [ERROR] Could not resolve … / asset directory missing`** — you deployed
before building. Run `bash scripts/export-static.sh` first (Option B: make
sure the build command is set as shown above).

**API returns 404 after drag-and-drop deploy** — drag-and-drop uploads
assets only. Use Option A or B so the `worker/` API ships too.

**`wrangler pages deploy out` warning** — legacy command. This project is a
Workers project now; use `npx wrangler deploy`.

**`/api/track/…` returns 502 "backend responded …"** — your metadata backend
is down or the URL is wrong. Check `ANTRA_GATEWAY_URL` and open
`<backend>/health` directly.

**Playback fails with "No stream source configured"** — that is the intended
metadata-only behavior. Set `ANTRA_STREAM_TEMPLATE` (step 4) to enable audio.

## Legal note

This platform hosts no copyrighted media. Metadata is sourced from the backend
you configure; audio playback is delegated to the resolver you configure, and
you are responsible for holding the rights to anything you serve.
