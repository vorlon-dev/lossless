// ─── Antra Flux — API core (framework-agnostic) ─────────────────────────────
// Pure Web-standard Request/Response handling shared by:
//   • Next.js route handlers (src/app/api/*) for local dev & preview
//   • Cloudflare Pages Functions (functions/api/*) for free production hosting
// Talks to a self-hosted Antra gateway (Python) when GATEWAY_URL is set,
// otherwise serves the built-in demo catalog so everything works standalone.

import {
  DEMO_ALBUMS,
  DEMO_ARTISTS,
  DEMO_TRACKS,
  demoAlbumById,
  demoFileFor,
  demoSearch,
  demoTrackById,
  DEMO_VERSION,
} from "./demo-catalog";
import type {
  Album,
  ApiMode,
  Artist,
  SearchResults,
  StatusResponse,
  Track,
} from "./types";

export const VERSION = "1.0.0";

export interface ApiEnv {
  /** Base URL of your self-hosted Antra gateway, e.g. https://antra-gw.example.workers.dev */
  GATEWAY_URL?: string;
  /** Optional shared secret. When set, clients must send header "x-api-key" (or ?key=). */
  API_KEY?: string;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Range, X-Api-Key, Authorization",
  "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges, Content-Length, Content-Type",
  "Access-Control-Max-Age": "86400",
};

function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS_HEADERS, ...extra },
  });
}

function err(message: string, status: number, detail?: string): Response {
  return json({ error: message, detail, status }, status);
}

// ── tiny TTL cache ───────────────────────────────────────────────────────────
const cache = new Map<string, { at: number; data: unknown }>();
function getCached<T>(key: string, ttlMs: number): T | undefined {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T;
  if (hit) cache.delete(key);
  return undefined;
}
function setCached(key: string, data: unknown) {
  if (cache.size > 500) cache.clear();
  cache.set(key, { at: Date.now(), data });
}

function gatewayUrl(env: ApiEnv): string | undefined {
  const raw = (env.GATEWAY_URL ?? "").trim();
  if (!raw) return undefined;
  return raw.replace(/\/+$/, "");
}

function checkApiKey(request: Request, env: ApiEnv): boolean {
  const key = (env.API_KEY ?? "").trim();
  if (!key) return true; // open endpoint when no key configured
  const url = new URL(request.url);
  const provided = request.headers.get("x-api-key") ?? url.searchParams.get("key") ?? "";
  return provided === key;
}

async function fetchUpstream(url: string, init?: RequestInit, timeoutMs = 12000): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
  });
}

// ── upstream normalization ───────────────────────────────────────────────────
// The Antra gateway returns the same shapes as this API; raw Antra CLI output
// ({"type": "...", "data": ...}) is normalized defensively as well.
interface RawSearchItem {
  title?: string;
  artists?: string[];
  artist_string?: string;
  album?: string;
  duration_ms?: number;
  artwork_url?: string;
  stream_id?: string;
  source?: string;
  bit_depth?: number;
  sample_rate_hz?: number;
  audio_format?: string;
  quality_kbps?: number;
  is_lossless?: boolean;
  is_explicit?: boolean;
  track_number?: number;
  release_year?: number;
}

function normalizeRawItem(item: RawSearchItem, i: number): Track {
  const codec = (item.audio_format ?? "FLAC").toUpperCase();
  const bitDepth = item.bit_depth;
  const sampleRateHz = item.sample_rate_hz;
  const lossless = item.is_lossless ?? ["FLAC", "ALAC"].includes(codec);
  const id = item.stream_id ?? `raw-${i}`;
  let label = codec;
  if (lossless && bitDepth && sampleRateHz) label = `${codec} ${bitDepth}-bit/${Math.round(sampleRateHz / 1000)}kHz`;
  else if (lossless && bitDepth) label = `${codec} ${bitDepth}-bit`;
  else if (!lossless && item.quality_kbps) label = `${codec} ${item.quality_kbps}kbps`;
  return {
    id: String(id),
    title: item.title ?? "Unknown",
    artists: item.artists ?? (item.artist_string ? item.artist_string.split(", ") : []),
    album: item.album ?? "",
    durationMs: item.duration_ms ?? 0,
    trackNumber: item.track_number,
    releaseYear: item.release_year,
    artworkUrl: item.artwork_url,
    explicit: item.is_explicit,
    format: {
      codec,
      bitDepth,
      sampleRateHz,
      bitrateKbps: lossless ? undefined : item.quality_kbps,
      lossless,
    },
    qualityLabel: label,
    hiRes: lossless && (!!bitDepth && bitDepth >= 24 || !!sampleRateHz && sampleRateHz > 48000),
    streamUrl: `/api/stream/${encodeURIComponent(String(id))}`,
    source: item.source,
  };
}

function normalizeUpstreamSearch(payload: unknown): SearchResults {
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const inner = (obj.results ?? obj.data ?? obj) as Record<string, unknown> | undefined;
    const rawList = (inner?.tracks ?? inner?.items ?? inner) as unknown;
    if (Array.isArray(rawList)) {
      const raw = rawList as RawSearchItem[];
      const tracks = raw.map(normalizeRawItem);
      const albums = Array.isArray(inner?.albums)
        ? (inner.albums as unknown[]).map(normalizeAlbum).filter(Boolean as unknown as (a: unknown) => Album)
        : [];
      const artists = Array.isArray(inner?.artists)
        ? (inner.artists as unknown[]).map(normalizeArtist).filter(Boolean as unknown as (a: unknown) => Artist)
        : [];
      return { tracks, albums: albums as Album[], artists: artists as Artist[] };
    }
    const tracks = Array.isArray(inner?.tracks) ? (inner!.tracks as Track[]) : [];
    const albums = Array.isArray(inner?.albums) ? (inner!.albums as Album[]) : [];
    const artists = Array.isArray(inner?.artists) ? (inner!.artists as Artist[]) : [];
    if (tracks.length || albums.length || artists.length) return { tracks, albums, artists };
  }
  return { tracks: [], albums: [], artists: [] };
}

function normalizeAlbum(a: unknown): Album | null {
  if (!a || typeof a !== "object") return null;
  const o = a as Record<string, unknown>;
  if (!o.title && !o.name) return null;
  return {
    id: String(o.id ?? o.album_id ?? ""),
    title: String(o.title ?? o.name ?? ""),
    artists: (o.artists as string[]) ?? (o.artist_string ? String(o.artist_string).split(", ") : []),
    year: o.year != null ? Number(o.year) : (o.release_year != null ? Number(o.release_year) : undefined),
    artworkUrl: (o.artwork_url as string) ?? (o.artworkUrl as string),
    genres: o.genres as string[] | undefined,
    trackCount: Number(o.track_count ?? o.trackCount ?? (Array.isArray(o.tracks) ? o.tracks.length : 0)),
    tracks: Array.isArray(o.tracks) ? (o.tracks as Track[]) : [],
  };
}

function normalizeArtist(a: unknown): Artist | null {
  if (!a || typeof a !== "object") return null;
  const o = a as Record<string, unknown>;
  if (!o.name) return null;
  return {
    id: String(o.id ?? ""),
    name: String(o.name),
    artworkUrl: (o.artwork_url as string) ?? (o.artworkUrl as string),
    albumCount: o.album_count != null ? Number(o.album_count) : undefined,
    trackCount: o.track_count != null ? Number(o.track_count) : undefined,
  };
}

// ── main handler ─────────────────────────────────────────────────────────────
export async function handleApiRequest(request: Request, env: ApiEnv): Promise<Response> {
  const url = new URL(request.url);
  let path = url.pathname.replace(/^\/api\/?/, "").replace(/\/+$/, "");

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return err("Method not allowed", 405);
  }
  if (!checkApiKey(request, env)) {
    return err("Unauthorized — send your key via the 'x-api-key' header", 401);
  }

  // strip an optional "stream"/"track" style leading segment handled below
  const segments = path.split("/").filter(Boolean);
  const gw = gatewayUrl(env);
  const mode: ApiMode = gw ? "live" : "demo";
  const q = url.searchParams;
  const started = Date.now();

  try {
    // ── GET /api/status ──────────────────────────────────────────────────────
    if (path === "status") {
      let gatewayOnline = false;
      if (gw) {
        try {
          const r = await fetchUpstream(`${gw}/health`, undefined, 6000);
          gatewayOnline = r.ok;
        } catch {
          gatewayOnline = false;
        }
      }
      const status: StatusResponse = {
        service: "antra-flux",
        version: VERSION,
        mode,
        gatewayUrl: gw,
        gatewayOnline,
        engine: gw ? "Antra (Python) gateway" : "demo-catalog",
        formats: ["FLAC", "ALAC", "AAC", "MP3"],
        maxQuality: gw ? "up to 24-bit/192kHz (depends on source)" : "FLAC 16-bit/44.1kHz (demo)",
        endpoints: ENDPOINT_DOCS,
        copyrightNotice:
          "Streams content via user-configured sources. You are responsible for holding the rights to stream anything you serve.",
      };
      return json(status);
    }

    // ── GET /api/search?q=&kind=&limit= ─────────────────────────────────────
    if (path === "search") {
      const query = q.get("q") ?? q.get("query") ?? "";
      const kindParam = (q.get("kind") ?? q.get("type") ?? "").toLowerCase();
      const kind = (["song", "album", "artist"].includes(kindParam) ? kindParam : "song") as
        | "song"
        | "album"
        | "artist";
      const limit = Math.min(50, Math.max(1, Number(q.get("limit") ?? 25) || 25));
      const cacheKey = `search:${query}:${kind}:${limit}:${mode}:${gw ?? ""}`;
      let results: SearchResults | undefined = getCached(cacheKey, 60_000);
      if (!results) {
        if (mode === "live" && gw) {
          const r = await fetchUpstream(
            `${gw}/search?q=${encodeURIComponent(query)}&kind=${kind}&limit=${limit}`
          );
          if (!r.ok) return err("Upstream gateway error", 502, `gateway responded ${r.status}`);
          results = normalizeUpstreamSearch(await r.json());
        } else {
          results = demoSearch(query, kind, limit);
        }
        setCached(cacheKey, results);
      }
      return json({ query, kind, mode, tookMs: Date.now() - started, results });
    }

    // ── GET /api/track/{id} ─────────────────────────────────────────────────
    if (segments[0] === "track" && segments[1]) {
      const id = decodeURIComponent(segments[1]);
      if (mode === "live" && gw) {
        const r = await fetchUpstream(`${gw}/track/${encodeURIComponent(id)}`);
        if (!r.ok) return err("Track not found upstream", r.status === 404 ? 404 : 502);
        return json(await r.json());
      }
      const track = demoTrackById(id);
      if (!track) return err("Track not found in demo catalog", 404);
      return json(track);
    }

    // ── GET /api/album/{id} ─────────────────────────────────────────────────
    if (segments[0] === "album" && segments[1]) {
      const id = decodeURIComponent(segments[1]);
      if (mode === "live" && gw) {
        const r = await fetchUpstream(`${gw}/album/${encodeURIComponent(id)}`);
        if (!r.ok) return err("Album not found upstream", r.status === 404 ? 404 : 502);
        return json(await r.json());
      }
      const album = demoAlbumById(id);
      if (!album) return err("Album not found in demo catalog", 404);
      return json(album);
    }

    // ── GET /api/lyrics/{id} ────────────────────────────────────────────────
    if (segments[0] === "lyrics" && segments[1]) {
      const id = decodeURIComponent(segments[1]);
      if (mode === "live" && gw) {
        const r = await fetchUpstream(`${gw}/lyrics/${encodeURIComponent(id)}`);
        if (!r.ok) return err("Lyrics not found upstream", r.status === 404 ? 404 : 502);
        return json(await r.json());
      }
      const track = demoTrackById(id);
      if (!track) return err("Track not found in demo catalog", 404);
      return json({
        trackId: id,
        title: track.title,
        artists: track.artists,
        plain: track.lyrics?.plain ?? "",
        syncedLrc: track.lyrics?.syncedLrc ?? "",
        hasSynced: !!track.lyrics?.syncedLrc,
      });
    }

    // ── GET /api/stream/{id} ────────────────────────────────────────────────
    if (segments[0] === "stream" && segments[1]) {
      const id = decodeURIComponent(segments[1]);
      if (mode === "demo") {
        const file = demoFileFor(id);
        if (!file) return err("Stream not found in demo catalog", 404);
        // Redirect to the bundled lossless file (same origin).
        return new Response(null, {
          status: 302,
          headers: {
            Location: `/demo-audio/${encodeURIComponent(file)}.flac`,
            ...CORS_HEADERS,
          },
        });
      }
      // live: proxy the gateway's stream, preserving Range for seeking
      const range = request.headers.get("range");
      const upstream = await fetchUpstream(
        `${gw}/stream/${encodeURIComponent(id)}`,
        { headers: range ? { Range: range } : {} },
        0 || 30000
      );
      if (!upstream.ok && upstream.status !== 206) {
        return err("Upstream stream unavailable", 502, `gateway responded ${upstream.status}`);
      }
      const ct = upstream.headers.get("content-type") ?? "audio/flac";
      const headers: Record<string, string> = {
        "Content-Type": ct,
        "Accept-Ranges": "bytes",
        ...CORS_HEADERS,
      };
      const cl = upstream.headers.get("content-length");
      if (cl) headers["Content-Length"] = cl;
      const cr = upstream.headers.get("content-range");
      if (cr) headers["Content-Range"] = cr;
      return new Response(upstream.body, { status: upstream.status === 206 ? 206 : 200, headers });
    }

    // ── GET /api/catalog  (browse helper) ───────────────────────────────────
    if (path === "catalog") {
      if (mode === "live" && gw) {
        const r = await fetchUpstream(`${gw}/catalog`);
        if (!r.ok) return err("Upstream gateway error", 502);
        return json(await r.json());
      }
      return json({
        mode,
        albums: DEMO_ALBUMS,
        artists: DEMO_ARTISTS,
        tracks: DEMO_TRACKS,
        version: DEMO_VERSION,
      });
    }

    return err("Not found", 404, `No API route matches /api/${path}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return err("Internal error", 500, msg);
  }
}

// ── endpoint docs (served via /api/status + rendered on the API page) ────────
export const ENDPOINT_DOCS = [
  { method: "GET", path: "/api/status", description: "Service status, mode (demo/live), capability list" },
  { method: "GET", path: "/api/search", description: "Search the catalog — params: q, kind (song|album|artist), limit (1-50)" },
  { method: "GET", path: "/api/catalog", description: "Browse everything currently indexed (albums, artists, tracks)" },
  { method: "GET", path: "/api/track/{id}", description: "Full metadata for one track (format, quality, ISRC, artwork)" },
  { method: "GET", path: "/api/album/{id}", description: "Album with its ordered tracklist" },
  { method: "GET", path: "/api/stream/{id}", description: "Stream lossless audio — supports HTTP Range seeking, CORS-enabled for any app" },
  { method: "GET", path: "/api/lyrics/{id}", description: "Lyrics — plain text and synced LRC when available" },
];
