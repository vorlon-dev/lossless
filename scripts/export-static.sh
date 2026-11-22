#!/usr/bin/env bash
# ─── Antra Flux — Cloudflare Pages static export ─────────────────────────────
# Produces:
#   out/                 → the static site (upload as a Pages project, or via wrangler)
#   functions/api/**     → Pages Functions providing the live /api/* endpoints
#
# Why the move trick: Next.js refuses a static export while dynamic route
# handlers exist. The handlers are replaced in production by the Pages
# Functions (same shared code in src/lib/api-core.ts), so they are safely
# parked during the export build and restored afterwards.

set -euo pipefail
cd "$(dirname "$0")/.."

BACKUP_DIR=".api-routes-parked"

restore() {
  if [ -d "$BACKUP_DIR" ]; then
    mkdir -p src/app
    rm -rf src/app/api
    mv "$BACKUP_DIR" src/app/api
    echo "✔ API route handlers restored to src/app/api"
  fi
}
trap restore EXIT

echo "→ Parking Next.js API route handlers…"
if [ -d src/app/api ]; then
  mv src/app/api "$BACKUP_DIR"
fi

echo "→ Building static export (CF_EXPORT=1)…"
if command -v bunx >/dev/null 2>&1; then
  CF_EXPORT=1 bunx next build
else
  CF_EXPORT=1 npx --yes next build
fi

echo "→ Static site ready in ./out"
echo "   Deploy with one of:"
echo "     npx wrangler pages deploy out        (CLI)"
echo "     or drag-and-drop ./out at dash.cloudflare.com → Workers & Pages → Pages"

# functions/ ships alongside out/ — wrangler pages deploy picks it up automatically.
