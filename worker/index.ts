// ─── Antra Flux — Cloudflare Worker entry (Workers with static assets) ──────
// The public /api/* endpoints run through the shared framework-agnostic core
// (src/lib/api-core.ts) — the same code the Next.js dev routes use.
// Everything else is served by the static-assets pipeline (out/), which is
// unlimited and free on Cloudflare; only /api/* calls invoke this Worker
// (100k requests/day on the free plan).
//
// Deploy:  npx wrangler deploy        (build out/ first — scripts/export-static.sh)

import { handleApiRequest } from "../src/lib/api-core";

interface Env {
  /** Static-assets binding generated from [assets] in wrangler.toml */
  ASSETS: { fetch(request: Request): Promise<Response> };
  /** Optional: base URL of your self-hosted Antra gateway (live mode) */
  ANTRA_GATEWAY_URL?: string;
  /** Optional: shared secret clients must send as x-api-key (or ?key=) */
  ANTRA_API_KEY?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === "/api" || pathname.startsWith("/api/")) {
      return handleApiRequest(request, {
        GATEWAY_URL: env.ANTRA_GATEWAY_URL,
        API_KEY: env.ANTRA_API_KEY,
      });
    }

    // Not an API call → serve the static site (assets pipeline handles
    // trailing slashes and the SPA fallback for unknown routes).
    return env.ASSETS.fetch(request);
  },
};
