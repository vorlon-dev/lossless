"use client";
// ─── Antra Flux — frontend API client ────────────────────────────────────────
// Talks to this site's own /api/* endpoints by default, or straight to a
// user-configured YTM metadata backend (CORS-enabled) when one is set in
// Settings. Normalization logic is shared with the server via src/lib/ytm.ts.
import type { Album, CatalogResponse, SearchResults, StatusResponse } from "./types";
import {
  normalizeAlbumDetail,
  normalizeSearchAggregate,
  normalizeTypedSearch,
  DEFAULT_GATEWAY,
} from "./ytm";

export function normalizeGateway(url: string): string {
  return url.trim().replace(/\/+$/, "") || DEFAULT_GATEWAY;
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

export async function fetchCatalog(signal?: AbortSignal): Promise<CatalogResponse> {
  return req<CatalogResponse>("/api/catalog", signal);
}

export interface SearchParams {
  q: string;
  kind?: "song" | "album" | "artist" | "all";
  limit?: number;
  gateway?: string | null;
  signal?: AbortSignal;
}

const EMPTY: SearchResults = { tracks: [], albums: [], artists: [] };

export async function fetchSearch(p: SearchParams): Promise<SearchResults> {
  const kind = p.kind ?? "song";
  const limit = p.limit ?? 25;
  const q = encodeURIComponent(p.q);

  if (p.gateway) {
    // direct-to-backend mode (browser → YTM worker, no /api hop)
    const gw = normalizeGateway(p.gateway);
    let raw: unknown;
    if (kind === "all") {
      raw = await req<unknown>(`${gw}/search?q=${q}`, p.signal);
      const n = normalizeSearchAggregate(raw);
      return {
        tracks: n.tracks.slice(0, limit),
        albums: n.albums.slice(0, limit),
        artists: n.artists.slice(0, limit),
        playlists: n.playlists.slice(0, 12),
      };
    }
    const path = kind === "song" ? "/search/songs" : kind === "album" ? "/search/albums" : "/search/artists";
    raw = await req<unknown>(`${gw}${path}?q=${q}`, p.signal);
    const n = normalizeTypedSearch(raw, kind);
    return {
      tracks: n.tracks.slice(0, limit),
      albums: n.albums.slice(0, limit),
      artists: n.artists.slice(0, limit),
    };
  }

  const data = await req<{ results: SearchResults }>(
    `/api/search?q=${q}&kind=${kind}&limit=${limit}`,
    p.signal
  );
  return data.results ?? EMPTY;
}

export async function fetchAlbum(
  id: string,
  gateway?: string | null,
  signal?: AbortSignal
): Promise<Album> {
  if (gateway) {
    const gw = normalizeGateway(gateway);
    const raw = await req<unknown>(`${gw}/album/${encodeURIComponent(id)}`, signal);
    return normalizeAlbumDetail(raw, id);
  }
  return req<Album>(`/api/album/${encodeURIComponent(id)}`, signal);
}

export async function fetchLyrics(
  id: string,
  signal?: AbortSignal
): Promise<{ available: boolean; plain: string; hasSynced: boolean; source?: string }> {
  return req(`/api/lyrics/${encodeURIComponent(id)}`, signal);
}
