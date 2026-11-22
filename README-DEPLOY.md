# Deploying Antra Flux on Cloudflare — free tier

The project splits cleanly along Cloudflare's free-tier capabilities:

```
Cloudflare Pages (free)                     Your machine / any Python host
┌────────────────────────────────┐          ┌─────────────────────────────┐
│  out/  → static site (UI)      │          │  gateway/server.py          │
│  functions/api → /api/*        │ ───────► │  (wraps the Antra engine)   │
│        edge Functions          │          │  FLAC/ALAC streams          │
└────────────────────────────────┘          └─────────────────────────────┘
```

Cloudflare's free tier runs JavaScript at the edge — it cannot run the
Python Antra engine. So the **site + public API run as a Pages project**
(static export + Pages Functions), while audio sourcing runs in the small
Python gateway (`/gateway`) that you host wherever Python runs. Until a
gateway is connected, the whole site and every endpoint serve a built-in
original demo catalog, so nothing is broken out of the box.

---

## 1) Build the static site

```bash
bash scripts/export-static.sh
```

This parks the Next.js API route handlers, builds a fully static export into
`out/`, and restores the handlers. The production `/api/*` endpoints come
from `functions/api/[[path]].ts` — the same shared code, running as edge
Functions.

## 2) Deploy to Cloudflare (pick one)

### Option A — Wrangler CLI (recommended)

```bash
npm install -g wrangler     # or: bunx wrangler
wrangler login
wrangler pages deploy out   # run from the repo root so ./functions ships too
```

First deploy asks for a project name (e.g. `antra-flux`). You get:
`https://antra-flux.pages.dev` — done. Every later deploy is the same command.

### Option B — Git integration (auto-deploys on push)

1. Push this repo to GitHub.
2. Cloudflare dashboard → Workers & Pages → Pages → **Connect to Git**.
3. Build command: `bash scripts/export-static.sh` — Output: `out`
   (Functions in `functions/` are detected automatically).
4. Deploy.

### Option C — Dashboard drag-and-drop (static only)

Works for the UI **without** the API (drag `out/` into Pages). Use A or B if
you want the `/api` endpoints — drag-and-drop cannot include Functions.

## 3) Environment variables (optional, site-wide)

Dashboard → your Pages project → Settings → Environment variables:

| Variable | Meaning |
| --- | --- |
| `ANTRA_GATEWAY_URL` | Base URL of your self-hosted Antra gateway (e.g. `https://your-tunnel.trycloudflare.com`) — flips `/api/*` from demo to live |
| `ANTRA_API_KEY` | Optional shared secret; clients must send `x-api-key: <key>` |

(With wrangler: `wrangler pages secret put ANTRA_GATEWAY_URL`.)

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
- set `ANTRA_GATEWAY_URL` on the Pages project (site-wide live mode), or
- paste the URL in the site's **Settings** view (per-browser — handy for
  testing and for sharing with friends without changing the deployment).

## 5) Point your music apps at it

See the **API** view on the site (or `GET /api/status`) for the live endpoint
list and copy-paste examples for curl / Python / JS / generic players. The
streaming endpoints are CORS-open and Range-aware — mpv, VLC, Feishin,
Symfonium, custom apps, anything that plays HTTP audio.

```bash
curl "https://antra-flux.pages.dev/api/search?q=aurora&kind=song"
curl -L "https://antra-flux.pages.dev/api/stream/<id>" -o track.flac
```

---

## Costs (free tier)

- **Pages**: unlimited static requests; Functions 100k req/day. Audio bytes
  streamed through Functions count as requests, not bandwidth — a heavy
  private library might prefer keeping stream URLs direct (302) from your
  gateway instead of proxying.
- **Tunnel**: free.
- **Gateway host**: your PC or a free tier of a Python host.

## Legal note

This platform hosts no copyrighted media. It streams only what your own
gateway + configured sources resolve, and you are responsible for holding
the rights to anything you serve. The bundled demo catalog is original,
synthesized audio created for this project.
