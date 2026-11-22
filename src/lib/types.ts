// ─── Antra Flux — shared type definitions ────────────────────────────────────
// These types define the public streaming API contract. Any music app can
// consume the same JSON shapes from the /api/* endpoints.

export interface TrackFormat {
  codec: string;            // "FLAC" | "ALAC" | "MP3" | "AAC"
  bitDepth?: number;        // 16 | 24
  sampleRateHz?: number;    // 44100 | 96000 | 192000
  bitrateKbps?: number;     // lossy only
  lossless: boolean;
}

export interface Lyrics {
  plain?: string;
  syncedLrc?: string;       // LRC format "[mm:ss.xx] line"
}

export interface Track {
  id: string;
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
  qualityLabel: string;     // e.g. "FLAC 24-bit/96kHz"
  hiRes: boolean;           // bit depth >= 24 or sample rate > 48kHz
  streamUrl: string;        // relative "/api/stream/:id" or absolute URL
  source?: string;          // "demo" | "tidal" | "qobuz" | "deezer" | "apple" | ...
  sourceUrl?: string;       // original service link if known
  lyrics?: Lyrics;
}

export interface Album {
  id: string;
  title: string;
  artists: string[];
  year?: number;
  artworkUrl?: string;
  genres?: string[];
  trackCount: number;
  tracks: Track[];
}

export interface Artist {
  id: string;
  name: string;
  artworkUrl?: string;
  albumCount?: number;
  trackCount?: number;
}

export interface SearchResults {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
}

export interface SearchResponse {
  query: string;
  kind: "song" | "album" | "artist";
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
  engine: string;           // "Antra (Python) gateway" | "demo-catalog"
  formats: string[];
  maxQuality: string;
  endpoints: { method: string; path: string; description: string }[];
  copyrightNotice: string;
}

export type ApiMode = "demo" | "live";

export interface ApiError {
  error: string;
  detail?: string;
  status: number;
}
