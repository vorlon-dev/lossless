// ─── Cloudflare Pages Function: catch-all API handler ────────────────────────
// Mirrors the Next.js route handlers using the same shared core (src/lib/api-core).
// Deployed automatically when the functions/ directory ships with the Pages
// project — no extra build step, runs on the Pages free plan.

import { handleApiRequest } from "../../src/lib/api-core";

interface PagesContext {
  request: Request;
  env: Record<string, string | undefined>;
  params: Record<string, string | string[]>;
}

export async function onRequest(context: PagesContext): Promise<Response> {
  return handleApiRequest(context.request, {
    GATEWAY_URL: context.env.ANTRA_GATEWAY_URL,
    API_KEY: context.env.ANTRA_API_KEY,
  });
}
