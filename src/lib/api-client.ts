"use client";
// ─── Antra Flux — frontend API client ────────────────────────────────────────
// Talks to this site's own /api/* endpoints by default, or straight to a
// user-configured Antra gateway (CORS-enabled) when one is set in Settings.
import type { Album, SearchResults, StatusResponse, Track } from "./types";

export function normalizeGateway(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

async function req<T>(url: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!r.ok) {
    let detail = `HTTP ${r.status}`;
    try {
      const body = (await r.json()) as { error?: string; detail?: string };
      detail = body.detail ?? body.error ?? detail;
    } catch { /* keep default */ }
    throw new Error(detail);
  }
  return (await r.json()) as T;
}

export async function fetchStatus(signal?: AbortSignal): Promise<StatusResponse> {
  return req<StatusResponse>("/api/status", signal);
}

export async function fetchCatalog(signal?: AbortSignal): Promise<{
  albums: Album[];
  artists: { id: string; name: string; artworkUrl?: string }[];
  tracks: Track[];
}> {
  return req("/api/catalog", signal);
}

export interface SearchParams {
  q: string;
  kind?: "song" | "album" | "artist";
  limit?: number;
  gateway?: string | null;
  signal?: AbortSignal;
}

export async function fetchSearch(p: SearchParams): Promise<SearchResults> {
  const kind = p.kind ?? "song";
  const limit = p.limit ?? 25;
  if (p.gateway) {
    const gw = normalizeGateway(p.gateway);
    const raw = await req<unknown>(
      `${gw}/search?q=${encodeURIComponent(p.q)}&kind=${kind}&limit=${limit}`,
      p.signal
    );
    return normalizeUpstream(raw);
  }
  const data = await req<{ results: SearchResults }>(
    `/api/search?q=${encodeURIComponent(p.q)}&kind=${kind}&limit=${limit}`,
    p.signal
  );
  return data.results;
}

export async function fetchAlbum(
  id: string,
  gateway?: string | null,
  signal?: AbortSignal
): Promise<Album> {
  if (gateway) {
    const gw = normalizeGateway(gateway);
    const raw = await req<unknown>(`${gw}/album/${encodeURIComponent(id)}`, signal);
    const a = raw as Record<string, unknown>;
    return {
      id: String(a.id ?? id),
      title: String(a.title ?? a.name ?? "Album"),
      artists: (a.artists as string[]) ?? [],
      year: a.year != null ? Number(a.year) : undefined,
      artworkUrl: a.artwork_url as string | undefined,
      genres: a.genres as string[] | undefined,
      trackCount: Number(a.track_count ?? (Array.isArray(a.tracks) ? a.tracks.length : 0)),
      tracks: (a.tracks as Track[]) ?? [],
    };
  }
  return req<Album>(`/api/album/${encodeURIComponent(id)}`, signal);
}

// ── upstream normalization (mirrors api-core, for direct gateway responses) ──
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

export function normalizeUpstream(payload: unknown): SearchResults {
  if (!payload || typeof payload !== "object") return { tracks: [], albums: [], artists: [] };
  const obj = payload as Record<string, unknown>;
  const inner = (obj.results ?? obj.data ?? obj) as Record<string, unknown> | undefined;
  const rawList = (inner?.tracks ?? inner?.items ?? inner) as unknown;
  if (Array.isArray(rawList)) {
    const tracks = (rawList as RawSearchItem[]).map(normalizeRawItem);
    return { tracks, albums: [], artists: [] };
  }
  const tracks = Array.isArray(inner?.tracks)
    ? (inner!.tracks as Track[]).map((t) => ensureStreamUrl(t))
    : [];
  const albums = Array.isArray(inner?.albums) ? (inner!.albums as Album[]) : [];
  const artists = Array.isArray(inner?.artists) ? (inner!.artists as { id: string; name: string; artworkUrl?: string; albumCount?: number }[]) : [];
  return { tracks, albums, artists };
}

function ensureStreamUrl(t: Track): Track {
  if (t.streamUrl && t.streamUrl.startsWith("http")) return t;
  return { ...t, streamUrl: `/api/stream/${encodeURIComponent(t.id)}` };
}

function normalizeRawItem(item: RawSearchItem, i: number): Track {
  const codec = (item.audio_format ?? "FLAC").toUpperCase();
  const lossless = item.is_lossless ?? ["FLAC", "ALAC"].includes(codec);
  const id = String(item.stream_id ?? `raw-${i}`);
  let label = codec;
  if (lossless && item.bit_depth && item.sample_rate_hz)
    label = `${codec} ${item.bit_depth}-bit/${Math.round(item.sample_rate_hz / 1000)}kHz`;
  else if (lossless && item.bit_depth) label = `${codec} ${item.bit_depth}-bit`;
  else if (!lossless && item.quality_kbps) label = `${codec} ${item.quality_kbps}kbps`;
  return {
    id,
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
      bitDepth: item.bit_depth,
      sampleRateHz: item.sample_rate_hz,
      bitrateKbps: lossless ? undefined : item.quality_kbps,
      lossless,
    },
    qualityLabel: label,
    hiRes:
      lossless &&
      ((!!item.bit_depth && item.bit_depth >= 24) ||
        (!!item.sample_rate_hz && item.sample_rate_hz > 48000)),
    streamUrl: `/api/stream/${encodeURIComponent(id)}`,
    source: item.source,
  };
}
