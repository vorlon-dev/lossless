// ─── Antra Flux — API core (framework-agnostic) ─────────────────────────────
// Pure Web-standard Request/Response handling shared by:
//   • Next.js route handlers (src/app/api/*) for local dev & preview
//   • Cloudflare Pages Functions (functions/api/*) for free production hosting
//   • Cloudflare Workers entry (worker/index.ts)
//
// All metadata is served LIVE from the user's YouTube Music backend
// (ANTRA_GATEWAY_URL, default: https://ytm-backend.vorlon-revora.workers.dev).
// There is no demo catalog. Playback is delegated to an optional stream
// resolver template (ANTRA_STREAM_TEMPLATE) — /api/stream/{id} 302-redirects
// to it with {id} replaced by the video id.

import {
  DEFAULT_GATEWAY,
  normalizeAlbumDetail,
  normalizeArtistPage,
  normalizeChartArtists,
  normalizeLyrics,
  normalizeNewReleases,
  normalizePlaylistDetail,
  normalizeRelated,
  normalizeSearchAggregate,
  normalizeSuggestions,
  normalizeTrending,
  normalizeTrackDetail,
  normalizeTypedSearch,
} from "./ytm";
import type { ApiMode, StatusResponse } from "./types";

export const VERSION = "1.1.0";

export interface ApiEnv {
  /** Base URL of the YTM metadata backend */
  GATEWAY_URL?: string;
  /** Optional shared secret. When set, clients must send header "x-api-key" (or ?key=). */
  API_KEY?: string;
  /** Optional stream resolver URL template, e.g. "https://resolver.example/stream/{id}".
   *  "{id}" is replaced with the video id. When set, /api/stream/{id} 302-redirects there. */
  STREAM_TEMPLATE?: string;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Range, X-Api-Key, Authorization",
  "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges, Content-Length, Content-Type, Location",
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

// ── tiny TTL cache (per isolate) ─────────────────────────────────────────────
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

function gatewayUrl(env: ApiEnv): string {
  const raw = (env.GATEWAY_URL ?? "").trim() || DEFAULT_GATEWAY;
  return raw.replace(/\/+$/, "");
}

function checkApiKey(request: Request, env: ApiEnv): boolean {
  const key = (env.API_KEY ?? "").trim();
  if (!key) return true; // open endpoint when no key configured
  const url = new URL(request.url);
  const provided = request.headers.get("x-api-key") ?? url.searchParams.get("key") ?? "";
  return provided === key;
}

async function fetchUpstream(url: string, init?: RequestInit, timeoutMs = 15000): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
  });
}

async function getJson<T = unknown>(url: string, timeoutMs = 15000): Promise<T> {
  const r = await fetchUpstream(url, undefined, timeoutMs);
  if (!r.ok) throw new Error(`backend responded ${r.status}`);
  return (await r.json()) as T;
}

// ── main handler ─────────────────────────────────────────────────────────────
export async function handleApiRequest(request: Request, env: ApiEnv): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, "").replace(/\/+$/, "");

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return err("Method not allowed", 405);
  }
  if (!checkApiKey(request, env)) {
    return err("Unauthorized — send your key via the 'x-api-key' header", 401);
  }

  const segments = path.split("/").filter(Boolean);
  const gw = gatewayUrl(env);
  const mode: ApiMode = "live";
  const q = url.searchParams;
  const started = Date.now();
  const region = q.get("region") ?? "";

  try {
    // ── GET /api/status ──────────────────────────────────────────────────────
    if (path === "status") {
      let gatewayOnline = false;
      try {
        const r = await fetchUpstream(`${gw}/health`, undefined, 6000);
        gatewayOnline = r.ok;
      } catch {
        gatewayOnline = false;
      }
      const status: StatusResponse = {
        service: "antra-flux",
        version: VERSION,
        mode,
        gatewayUrl: gw,
        gatewayOnline,
        engine: "YTM backend (WEB_REMIX InnerTube proxy)",
        formats: ["AAC"],
        maxQuality: "AAC up to 256 kbps (source-dependent; lossless depends on your stream resolver)",
        endpoints: ENDPOINT_DOCS,
        copyrightNotice:
          "Metadata is sourced from the configured YouTube Music backend. Streams are delegated to the resolver you configure (ANTRA_STREAM_TEMPLATE). You are responsible for holding the rights to anything you stream.",
      };
      return json(status);
    }

    // ── GET /api/search?q=&kind=&limit= ─────────────────────────────────────
    if (path === "search") {
      const query = q.get("q") ?? q.get("query") ?? "";
      if (!query.trim()) return err("Missing query", 400, "Pass ?q=<search terms>");
      const kindParam = (q.get("kind") ?? q.get("type") ?? "song").toLowerCase();
      const kind = (["song", "album", "artist", "all"].includes(kindParam)
        ? kindParam
        : "song") as "song" | "album" | "artist" | "all";
      const limit = Math.min(50, Math.max(1, Number(q.get("limit") ?? 25) || 25));
      const cacheKey = `search:${query}:${kind}:${limit}:${gw}`;
      let results = getCached<ReturnType<typeof normalizeTypedSearch>>(cacheKey, 120_000);
      if (!results) {
        const enc = encodeURIComponent(query);
        if (kind === "all") {
          results = normalizeSearchAggregate(await getJson(`${gw}/search?q=${enc}`));
        } else if (kind === "song") {
          results = normalizeTypedSearch(await getJson(`${gw}/search/songs?q=${enc}`), "song");
        } else if (kind === "album") {
          results = normalizeTypedSearch(await getJson(`${gw}/search/albums?q=${enc}`), "album");
        } else {
          results = normalizeTypedSearch(await getJson(`${gw}/search/artists?q=${enc}`), "artist");
        }
        setCached(cacheKey, results);
      }
      const sliced = {
        tracks: results.tracks.slice(0, limit),
        albums: results.albums.slice(0, limit),
        artists: results.artists.slice(0, limit),
        playlists: results.playlists.slice(0, limit),
      };
      return json({ query, kind, mode, tookMs: Date.now() - started, results: sliced });
    }

    // ── GET /api/suggestions?q= (autocomplete) ──────────────────────────────
    if (path === "suggestions") {
      const query = q.get("q") ?? "";
      if (!query.trim()) return json({ suggestions: [] });
      const enc = encodeURIComponent(query);
      const suggestions = normalizeSuggestions(await getJson(`${gw}/suggestions?q=${enc}`, 8000));
      return json({ query, suggestions });
    }

    // ── GET /api/catalog?region= (home / browse payload) ────────────────────
    if (path === "catalog") {
      const cacheKey = `catalog:${region}:${gw}`;
      const cached = getCached<Record<string, unknown>>(cacheKey, 300_000);
      if (cached) return json({ ...cached, tookMs: Date.now() - started });
      const reg = region ? `&region=${encodeURIComponent(region)}` : "";
      const [trendingRes, newReleasesRes, chartsRes] = await Promise.all([
        getJson(`${gw}/trending?full=1${reg}`).catch(() => null),
        getJson(`${gw}/new-releases${reg}`).catch(() => null),
        getJson(`${gw}/charts?country=US${reg}`).catch(() => null),
      ]);
      const trending = trendingRes ? normalizeTrending(trendingRes).slice(0, 30) : [];
      const newReleases = newReleasesRes ? normalizeNewReleases(newReleasesRes).slice(0, 20) : [];
      const topArtists = chartsRes ? normalizeChartArtists(chartsRes).slice(0, 24) : [];
      const payload = {
        mode,
        source: "youtube-music",
        backend: gw,
        trending,
        newReleases,
        topArtists,
        tookMs: Date.now() - started,
      };
      setCached(cacheKey, payload);
      return json(payload);
    }

    // ── GET /api/track/{id} ─────────────────────────────────────────────────
    if (segments[0] === "track" && segments[1]) {
      const id = decodeURIComponent(segments[1]);
      const enc = encodeURIComponent(id);
      const detail = normalizeTrackDetail(await getJson(`${gw}/song/${enc}`), id);
      // best-effort lyrics attach
      let lyrics: ReturnType<typeof normalizeLyrics> | undefined;
      try {
        lyrics = normalizeLyrics(await getJson(`${gw}/lyrics/${enc}`, 8000), id);
      } catch {
        lyrics = undefined;
      }
      return json({
        mode,
        track: detail.track,
        queue: detail.queue,
        playlistId: detail.playlistId,
        lyricsBrowseId: detail.lyricsBrowseId,
        relatedBrowseId: detail.relatedBrowseId,
        lyrics: lyrics?.available
          ? { plain: lyrics.plain, syncedLrc: lyrics.syncedLrc, hasSynced: lyrics.hasSynced }
          : undefined,
        streamUrl: `/api/stream/${enc}`,
        streamAvailable: !!env.STREAM_TEMPLATE,
      });
    }

    // ── GET /api/album/{id} ─────────────────────────────────────────────────
    if (segments[0] === "album" && segments[1]) {
      const id = decodeURIComponent(segments[1]);
      const enc = encodeURIComponent(id);
      const albumRaw = await getJson(`${gw}/album/${enc}`);
      // Backend quirk: album tracklists carry bogus artists. Resolve the real
      // artist from the first track's /song metadata and repair the tracklist.
      let realArtist: string[] | undefined;
      try {
        const data = ((albumRaw as { data?: Record<string, unknown> }).data ?? albumRaw) as Record<string, unknown>;
        const tracks = (data?.tracks as { videoId?: string }[] | undefined) ?? [];
        const firstVideoId = tracks[0]?.videoId;
        if (firstVideoId) {
          const songDetail = normalizeTrackDetail(
            await getJson(`${gw}/song/${encodeURIComponent(firstVideoId)}`, 10000)
          );
          realArtist = songDetail.track?.artists;
        }
      } catch {
        realArtist = undefined;
      }
      const album = normalizeAlbumDetail(albumRaw, id, realArtist);
      if (realArtist?.length && !album.artists.length) album.artists = realArtist;
      return json({ mode, ...album });
    }

    // ── GET /api/playlist/{id} ──────────────────────────────────────────────
    if (segments[0] === "playlist" && segments[1]) {
      const id = decodeURIComponent(segments[1]);
      const cursor = q.get("cursor");
      const cursorPart = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const raw = await getJson(`${gw}/playlist/${encodeURIComponent(id)}${cursorPart}`);
      const playlist = normalizePlaylistDetail(raw, id);
      const data = ((raw as { data?: Record<string, unknown> }).data ?? raw) as Record<string, unknown>;
      return json({
        mode,
        ...playlist,
        continuation: (data?.continuation as string) ?? undefined,
      });
    }

    // ── GET /api/artist/{id} ────────────────────────────────────────────────
    if (segments[0] === "artist" && segments[1]) {
      const id = decodeURIComponent(segments[1]);
      const enc = encodeURIComponent(id);
      const page = normalizeArtistPage(await getJson(`${gw}/artist/${enc}`), id);
      return json({ mode, ...page });
    }

    // ── GET /api/related/{id} ───────────────────────────────────────────────
    if (segments[0] === "related" && segments[1]) {
      const id = decodeURIComponent(segments[1]);
      const raw = await getJson(`${gw}/related/${encodeURIComponent(id)}`);
      const tracks = normalizeRelated(raw);
      return json({ mode, trackId: id, tracks });
    }

    // ── GET /api/radio/{id}?cursor= ─────────────────────────────────────────
    if (segments[0] === "radio" && segments[1]) {
      const id = decodeURIComponent(segments[1]);
      const cursor = q.get("cursor");
      const shuffle = q.get("shuffle");
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (shuffle) params.set("shuffle", shuffle);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const raw = await getJson(`${gw}/radio/${encodeURIComponent(id)}${qs}`);
      const data = ((raw as { data?: Record<string, unknown> }).data ?? raw) as Record<string, unknown>;
      const rawTracks = (data?.tracks as Record<string, unknown>[]) ?? [];
      // radio rows share the song-item shape — normalize through the typed path
      const normalized = normalizeTypedSearch({ data: { items: rawTracks } }, "song").tracks;
      return json({
        mode,
        trackId: id,
        playlistId: (data?.playlistId as string) ?? undefined,
        tracks: normalized,
        continuation: (data?.continuation as string) ?? undefined,
      });
    }

    // ── GET /api/lyrics/{id} ────────────────────────────────────────────────
    if (segments[0] === "lyrics" && segments[1]) {
      const id = decodeURIComponent(segments[1]);
      const lyrics = normalizeLyrics(await getJson(`${gw}/lyrics/${encodeURIComponent(id)}`, 8000), id);
      return json({ mode, ...lyrics });
    }

    // ── GET /api/stream/{id} ────────────────────────────────────────────────
    if (segments[0] === "stream" && segments[1]) {
      const id = decodeURIComponent(segments[1]);
      const template = (env.STREAM_TEMPLATE ?? "").trim();
      if (!template) {
        return err(
          "No stream source configured",
          502,
          "This deployment serves metadata only. Set ANTRA_STREAM_TEMPLATE (e.g. 'https://your-resolver.example/stream/{id}') to enable playback."
        );
      }
      const target = template.replace(/\{id\}/g, encodeURIComponent(id));
      return new Response(null, {
        status: 302,
        headers: { Location: target, "Cache-Control": "no-store", ...CORS_HEADERS },
      });
    }

    return err("Not found", 404, `No API route matches /api/${path}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return err("Upstream metadata backend error", 502, msg);
  }
}

// ── endpoint docs (served via /api/status + rendered on the API page) ────────
export const ENDPOINT_DOCS = [
  { method: "GET", path: "/api/status", description: "Service status, backend health, capability list" },
  { method: "GET", path: "/api/search", description: "Search YouTube Music — params: q, kind (song|album|artist|all), limit (1-50)" },
  { method: "GET", path: "/api/suggestions", description: "Search autocomplete — params: q" },
  { method: "GET", path: "/api/catalog", description: "Browse payload: trending songs, new releases, top artists — param: region" },
  { method: "GET", path: "/api/track/{id}", description: "Full track metadata + queue context + lyrics (id = YouTube video id)" },
  { method: "GET", path: "/api/album/{id}", description: "Album with ordered tracklist (id = MPREb_… browse id)" },
  { method: "GET", path: "/api/playlist/{id}", description: "Playlist with tracks — infinite via ?cursor=" },
  { method: "GET", path: "/api/artist/{id}", description: "Artist page: top tracks, albums, singles, videos, related" },
  { method: "GET", path: "/api/related/{id}", description: "Related tracks for a song" },
  { method: "GET", path: "/api/radio/{id}", description: "Infinite radio queue for a seed song — ?cursor= to continue" },
  { method: "GET", path: "/api/lyrics/{id}", description: "Lyrics — plain text (synced when available)" },
  { method: "GET", path: "/api/stream/{id}", description: "Audio playback — 302 to your configured resolver (ANTRA_STREAM_TEMPLATE)" },
];
