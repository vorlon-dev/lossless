// ─── Antra Flux — shared type definitions ────────────────────────────────────
// These types define the public streaming API contract. Any music app can
// consume the same JSON shapes from the /api/* endpoints. Metadata is sourced
// from a YouTube Music backend; playback goes through /api/stream/{id}.

export interface TrackFormat {
  codec: string;            // "AAC" (YTM source) | "FLAC" | "ALAC" | "MP3" …
  bitDepth?: number;        // not exposed by YTM backend
  sampleRateHz?: number;    // not exposed by YTM backend
  bitrateKbps?: number;     // 256 for AAC YTM streams
  lossless: boolean;
}

export interface Lyrics {
  plain?: string;
  syncedLrc?: string;       // LRC format "[mm:ss.xx] line"
}

export interface Track {
  id: string;               // YouTube video id
  title: string;
  artists: string[];
  album: string;
  albumId?: string;
  durationMs: number;
  trackNumber?: number;
  discNumber?: number;
  releaseYear?: number;
  genres?: string[];
  artworkUrl?: string;
  isrc?: string;
  explicit?: boolean;
  format: TrackFormat;
  qualityLabel: string;     // e.g. "AAC 256"
  hiRes: boolean;
  streamUrl: string;        // relative "/api/stream/:id" or absolute URL
  source?: string;          // "youtube-music" | "tidal" | "qobuz" | …
  sourceUrl?: string;       // original service link if known
  lyrics?: Lyrics;
}

export interface Album {
  id: string;               // MPREb_… browse id (or playlist id for playlists)
  title: string;
  artists: string[];
  year?: number;
  artworkUrl?: string;
  genres?: string[];
  trackCount: number;
  tracks: Track[];
}

export interface Artist {
  id: string;               // UC… channel id
  name: string;
  artworkUrl?: string;
  albumCount?: number;
  trackCount?: number;
}

export interface SearchResults {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
  playlists?: Album[];      // playlist cards (openable via /api/playlist/{id})
}

export interface CatalogResponse {
  mode: ApiMode;
  source: string;
  backend: string;
  trending: Track[];
  newReleases: Album[];
  topArtists: Artist[];
  tookMs?: number;
}

export interface SearchResponse {
  query: string;
  kind: "song" | "album" | "artist" | "all";
  mode: ApiMode;
  tookMs: number;
  results: SearchResults;
}

export interface StatusResponse {
  service: "antra-flux";
  version: string;
  mode: ApiMode;
  gatewayUrl?: string;
  gatewayOnline: boolean;
  engine: string;           // "YTM metadata backend (Cloudflare Worker)"
  formats: string[];
  maxQuality: string;
  endpoints: { method: string; path: string; description: string }[];
  copyrightNotice: string;
}

export type ApiMode = "live";

export interface ApiError {
  error: string;
  detail?: string;
  status: number;
}
