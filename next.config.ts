import type { NextConfig } from "next";

/**
 * Build modes:
 *  - default          → standalone output (sandbox preview / Node hosting)
 *  - CF_EXPORT=1      → fully static export for Cloudflare Pages
 *                       (the /functions/api/* Pages Functions provide /api/*
 *                        in production, so the API route handlers are moved
 *                        aside by scripts/export-static.sh before this build)
 */
const isCfExport = process.env.CF_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(isCfExport ? { output: "export" as const, trailingSlash: true } : { output: "standalone" as const }),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
