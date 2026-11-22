# Deploying Antra Flux on Cloudflare — free tier

The project splits cleanly along Cloudflare's free-tier capabilities:

```
Cloudflare Workers (free)                    Your machine / any Python host
┌──────────────────────────────────┐         ┌─────────────────────────────┐
│  out/    → static site (assets)  │         │  gateway/server.py          │
│  worker/ → /api/* Worker         │ ──────► │  (wraps the Antra engine)   │
│          unlimited asset reqs,   │         │  FLAC/ALAC streams          │
│          100k API calls/day      │         │                             │
└──────────────────────────────────┘         └─────────────────────────────┘
```

Cloudflare's free tier runs JavaScript at the edge — it cannot run the
Python Antra engine. So the **site + public API run as one Workers project**
(static assets + a tiny API Worker), while audio sourcing runs in the small
Python gateway (`/gateway`) that you host wherever Python runs. Until a
gateway is connected, the whole site and every endpoint serve a built-in
original demo catalog, so nothing is broken out of the box.

---

## 1) Build the static site

```bash
bash scripts/export-static.sh
```

The demo media (10 synthesized FLAC tracks + cover art) ships committed in
`public/`. If you ever remove it, regenerate with one command:

```bash
pip install numpy pillow          # ffmpeg must also be on PATH
python3 scripts/gen_demo_assets.py
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
     (demo media is committed, so no generation step is needed. If you ever
     remove `public/demo-audio` + `public/covers` from the repo, use
     `pip install numpy pillow && python3 scripts/gen_demo_assets.py && bash scripts/export-static.sh`
     instead — requires python3 + ffmpeg on the build image.)
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

## 3) Environment variables (optional, site-wide)

Dashboard → your Worker → **Settings → Variables and Secrets**:

| Variable | Meaning |
| --- | --- |
| `ANTRA_GATEWAY_URL` | Base URL of your self-hosted Antra gateway (e.g. `https://your-tunnel.trycloudflare.com`) — flips `/api/*` from demo to live |
| `ANTRA_API_KEY` | Optional shared secret; clients must send `x-api-key: <key>` |

(With wrangler: `npx wrangler secret put ANTRA_GATEWAY_URL`. Or uncomment
them in `wrangler.toml` `[vars]` for non-secret values.)

## 4) Run the audio gateway somewhere

Full guide in [`gateway/README.md`](gateway/README.md). Quickest paths:

**Your PC + a free Cloudflare Tunnel:**
```bash
cd gateway && pip install -r requirements.txt
git clone https://github.com/anandprtp/Antra.git Antra
pip install -r Antra/requirements-runtime.txt
python server.py            # :8877
cloudflared tunnel --url http://localhost:8877   # free HTTPS URL
```

**Any Docker host / free Python host (HF Spaces, Render, Koyeb):** use
`gateway/Dockerfile` as-is.

Then either:
- set `ANTRA_GATEWAY_URL` on the Worker (site-wide live mode), or
- paste the URL in the site's **Settings** view (per-browser — handy for
  testing and for sharing with friends without changing the deployment).

## 5) Point your music apps at it

See the **API** view on the site (or `GET /api/status`) for the live endpoint
list and copy-paste examples for curl / Python / JS / generic players. The
streaming endpoints are CORS-open and Range-aware — mpv, VLC, Feishin,
Symfonium, custom apps, anything that plays HTTP audio.

```bash
curl "https://antra-flux.<your-subdomain>.workers.dev/api/search?q=aurora&kind=song"
curl -L "https://antra-flux.<your-subdomain>.workers.dev/api/stream/<id>" -o track.flac
```

---

## Costs (free tier)

- **Workers assets**: unlimited static requests, free. Audio bytes streamed
  via the 302 redirect are plain asset requests — not Worker invocations.
- **Worker**: only `/api/*` calls count — 100k requests/day free.
- **Tunnel**: free.
- **Gateway host**: your PC or a free tier of a Python host.

A heavy private library can also keep stream URLs direct (302) from your
gateway instead of proxying bytes through the Worker.

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

## Legal note

This platform hosts no copyrighted media. It streams only what your own
gateway + configured sources resolve, and you are responsible for holding
the rights to anything you serve. The bundled demo catalog is original,
synthesized audio created for this project.
