// ─── Antra Flux — YouTube Music backend normalizers (shared) ─────────────────
// Pure mapping functions that turn responses from the user's YTM backend
// (https://ytm-backend.vorlon-revora.workers.dev — InnerTube WEB_REMIX proxy)
// into the Antra Flux catalog types used across the UI and the public API.

import type { Album, Artist, Track } from "./types";

/** Base URL of the metadata backend. Override with ANTRA_GATEWAY_URL. */
export const DEFAULT_GATEWAY = "https://ytm-backend.vorlon-revora.workers.dev";

// ── raw backend shapes (as observed on the live deployment) ──────────────────
export interface YtmArtistRef {
  name: string;
  id?: string;
}

export interface YtmItem {
  type?: string; // song | video | album | artist | playlist | episode
  videoId?: string;
  id?: string;
  browseId?: string;
  title?: string;
  name?: string;
  subtitle?: string;
  artists?: YtmArtistRef[];
  album?: { name?: string; id?: string };
  duration?: string;
  durationSeconds?: number;
  views?: string;
  year?: string | number;
  playlistId?: string;
  thumbnail?: string;
  thumbnails?: { url: string; width?: number; height?: number }[];
  albumCount?: number;
  trackCount?: number;
}

export interface YtmEnvelope {
  ok?: boolean;
  data?: Record<string, unknown>;
}

/** Pick the highest-resolution artwork available on an item. */
export function bestThumb(item: YtmItem): string | undefined {
  if (item.thumbnail) return item.thumbnail;
  const thumbs = item.thumbnails ?? [];
  if (!thumbs.length) return undefined;
  const sorted = [...thumbs].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  // prefer something >= 300px wide, else the largest available
  return (sorted.find((t) => (t.width ?? 0) >= 300) ?? sorted[0]).url;
}

function artistNames(item: YtmItem): string[] {
  const list = item.artists ?? [];
  return list
    .map((a) => a?.name)
    .filter((n): n is string => !!n && n.trim().length > 0);
}

/** YTM web streams AAC up to 256 kbps — the metadata backend does not expose
 *  bit-depth info, so we report the codec family honestly. */
const YTM_FORMAT = {
  codec: "AAC",
  bitrateKbps: 256,
  lossless: false,
} as const;

/** song/video row → Flux Track */
export function ytmTrack(item: YtmItem, i = 0): Track {
  const id = String(item.videoId ?? item.id ?? `yt-${i}`);
  const durationMs = item.durationSeconds ? item.durationSeconds * 1000 : 0;
  return {
    id,
    title: item.title ?? item.name ?? "Unknown title",
    artists: artistNames(item),
    album: item.album?.name ?? "",
    albumId: item.album?.id,
    durationMs,
    releaseYear: item.year != null ? Number(item.year) : undefined,
    artworkUrl: bestThumb(item),
    streamUrl: `/api/stream/${encodeURIComponent(id)}`,
    format: { ...YTM_FORMAT },
    qualityLabel: "AAC 256",
    hiRes: false,
    source: "youtube-music",
    sourceUrl: `https://music.youtube.com/watch?v=${id}`,
  };
}

/** album row → Flux Album */
export function ytmAlbum(item: YtmItem): Album {
  const id = String(item.id ?? item.browseId ?? item.playlistId ?? "");
  return {
    id,
    title: item.title ?? item.name ?? "Unknown album",
    artists: artistNames(item),
    year: item.year != null ? Number(item.year) : undefined,
    artworkUrl: bestThumb(item),
    trackCount: item.trackCount ?? 0,
    tracks: [],
  };
}

/** artist row → Flux Artist */
export function ytmArtist(item: YtmItem): Artist {
  return {
    id: String(item.id ?? item.browseId ?? ""),
    name: item.title ?? item.name ?? "Unknown artist",
    artworkUrl: bestThumb(item),
    albumCount: item.albumCount,
    trackCount: item.trackCount,
  };
}

/** playlist row → lightweight album-shaped card (openable via /api/playlist/{id}) */
export function ytmPlaylistCard(item: YtmItem): Album {
  const id = String(item.id ?? item.playlistId ?? item.browseId ?? "");
  return {
    id,
    title: item.title ?? item.name ?? "Unknown playlist",
    artists: artistNames(item).length ? artistNames(item) : [item.subtitle ?? ""].filter(Boolean),
    artworkUrl: bestThumb(item),
    trackCount: item.trackCount ?? 0,
    tracks: [],
  };
}

// ── payload-level normalizers ────────────────────────────────────────────────

const asItems = (payload: unknown): YtmItem[] => {
  const data = (payload as YtmEnvelope)?.data ?? (payload as Record<string, unknown>);
  if (!data) return [];
  for (const key of ["items", "tracks", "albums", "artists", "videos"]) {
    const v = (data as Record<string, unknown>)[key];
    if (Array.isArray(v)) return v as YtmItem[];
  }
  return [];
};

const splitByType = (items: YtmItem[]) => {
  const tracks: Track[] = [];
  const albums: Album[] = [];
  const artists: Artist[] = [];
  const playlists: Album[] = [];
  for (const it of items) {
    const t = (it.type ?? "").toLowerCase();
    if (t === "song" || t === "video") tracks.push(ytmTrack(it));
    else if (t === "album") albums.push(ytmAlbum(it));
    else if (t === "artist") artists.push(ytmArtist(it));
    else if (t === "playlist") playlists.push(ytmPlaylistCard(it));
  }
  return { tracks, albums, artists, playlists };
};

export interface NormalizedSearch {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
  playlists: Album[];
}

/** Normalize the aggregate /search payload (topResult + typed items). */
export function normalizeSearchAggregate(payload: unknown): NormalizedSearch {
  const data = ((payload as YtmEnvelope)?.data ?? payload) as Record<string, unknown> | undefined;
  const items = asItems(payload);
  const out = splitByType(items);
  // surface a song topResult as the first track
  const top = data?.topResult as YtmItem | undefined;
  if (top && (top.type ?? "").toLowerCase() === "song" && top.videoId) {
    const track = ytmTrack(top);
    if (!out.tracks.some((t) => t.id === track.id)) out.tracks.unshift(track);
  }
  return out;
}

/** Normalize /search/songs, /search/albums, /search/artists, /trending. */
export function normalizeTypedSearch(
  payload: unknown,
  kind: "song" | "album" | "artist"
): NormalizedSearch {
  const items = asItems(payload);
  if (kind === "song") return { tracks: items.map((it) => ytmTrack(it)), albums: [], artists: [], playlists: [] };
  if (kind === "album") return { tracks: [], albums: items.map((it) => ytmAlbum(it)), artists: [], playlists: [] };
  return { tracks: [], albums: [], artists: items.map((it) => ytmArtist(it)), playlists: [] };
}

/** Normalize /album/:id into a full Flux Album with tracklist.
 *  Backend quirk: album track rows carry `artists: [{name: <track title>}]`
 *  (bogus) — pass realArtist when known to repair the tracklist. */
export function normalizeAlbumDetail(payload: unknown, fallbackId = "", realArtist?: string[]): Album {
  const data = ((payload as YtmEnvelope)?.data ?? payload) as Record<string, unknown>;
  const rawTracks = (data?.tracks as YtmItem[]) ?? [];
  const tracks = rawTracks.map((t) => {
    const track = ytmTrack(t);
    track.album = (data?.title as string) ?? "";
    track.albumId = (data?.id as string) ?? fallbackId;
    // repair the backend's bogus track artists when we know the album artist
    if (realArtist?.length && (!track.artists.length || track.artists.join(", ") === track.title)) {
      track.artists = [...realArtist];
    }
    return track;
  });
  const albumItem: YtmItem = {
    id: (data?.id as string) ?? fallbackId,
    title: (data?.title as string) ?? "Unknown album",
    year: data?.year != null ? Number(data.year) : undefined,
    thumbnail: data?.thumbnail as string | undefined,
    thumbnails: data?.thumbnails as YtmItem["thumbnails"],
  };
  const album = ytmAlbum(albumItem);
  album.trackCount = tracks.length;
  album.tracks = tracks;
  return album;
}

/** Normalize /playlist/:id into a playable album-shaped entity. */
export function normalizePlaylistDetail(payload: unknown, fallbackId = ""): Album {
  const data = ((payload as YtmEnvelope)?.data ?? payload) as Record<string, unknown>;
  const tracks = ((data?.tracks as YtmItem[]) ?? []).map((t) => ytmTrack(t));
  return {
    id: (data?.id as string) ?? (data?.playlistId as string) ?? fallbackId,
    title: (data?.title as string) ?? "Unknown playlist",
    artists: artistNames(data as YtmItem),
    year: data?.year != null ? Number(data.year) : undefined,
    artworkUrl: bestThumb(data as YtmItem),
    trackCount: tracks.length,
    tracks,
  };
}

/** Normalize /song/:id → track detail + queue context. */
export function normalizeTrackDetail(payload: unknown, fallbackId = "") {
  const data = ((payload as YtmEnvelope)?.data ?? payload) as Record<string, unknown>;
  const queue = ((data?.tracks as YtmItem[]) ?? []).map((t) => ytmTrack(t));
  const current = (data?.current as YtmItem) ?? queue[0];
  const track = current ? ytmTrack(current) : undefined;
  if (track && !track.id) track.id = fallbackId;
  return {
    track,
    queue,
    playlistId: (data?.playlistId as string) ?? undefined,
    lyricsBrowseId: (data?.lyricsBrowseId as string) ?? undefined,
    relatedBrowseId: (data?.relatedBrowseId as string) ?? undefined,
  };
}

/** Normalize /home → shelves of cards (playlists / albums / songs). */
export function normalizeHomeShelves(payload: unknown) {
  const data = ((payload as YtmEnvelope)?.data ?? payload) as Record<string, unknown>;
  const shelves = ((data?.shelves as { title?: string; items?: YtmItem[] }[]) ?? []).map((s) => ({
    title: s.title ?? "",
    items: (s.items ?? []).map((it) => {
      const t = (it.type ?? "").toLowerCase();
      if (t === "song" || t === "video") return { kind: "song" as const, track: ytmTrack(it) };
      if (t === "album") return { kind: "album" as const, album: ytmAlbum(it) };
      if (t === "playlist") return { kind: "playlist" as const, playlist: ytmPlaylistCard(it) };
      return { kind: "other" as const };
    }),
  }));
  return shelves;
}

/** Flatten /new-releases carousels into a plain album list. */
export function normalizeNewReleases(payload: unknown): Album[] {
  const data = ((payload as YtmEnvelope)?.data ?? payload) as Record<string, unknown>;
  const carousels = ((data?.carousels as { title?: string; items?: YtmItem[] }[]) ?? []) ?? [];
  const albums: Album[] = [];
  for (const c of carousels) {
    for (const it of c.items ?? []) {
      const t = (it.type ?? "").toLowerCase();
      if (t === "album") albums.push(ytmAlbum(it));
    }
  }
  // dedupe by id
  const seen = new Set<string>();
  return albums.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
}

/** Extract trending song rows. */
export function normalizeTrending(payload: unknown): Track[] {
  return asItems(payload)
    .filter((it) => ["song", "video"].includes((it.type ?? "").toLowerCase()))
    .map((it) => ytmTrack(it));
}

/** Extract the "Top artists" shelf from /charts. */
export function normalizeChartArtists(payload: unknown): Artist[] {
  const data = ((payload as YtmEnvelope)?.data ?? payload) as Record<string, unknown>;
  const shelves = (data?.shelves as { title?: string; items?: YtmItem[] }[]) ?? [];
  for (const s of shelves) {
    const title = (s.title ?? "").toLowerCase();
    const items = s.items ?? [];
    if (title.includes("artist") || (items.length && (items[0].type ?? "").toLowerCase() === "artist")) {
      return items.map((it) => ytmArtist(it));
    }
  }
  return [];
}

/** Normalize /artist/:id into sections. */
export function normalizeArtistPage(payload: unknown, fallbackId = "") {
  const data = ((payload as YtmEnvelope)?.data ?? payload) as Record<string, unknown>;
  const toTracks = (v: unknown) =>
    (Array.isArray((v as { items?: YtmItem[] })?.items) ? (v as { items: YtmItem[] }).items : [])
      .map((it) => ytmTrack(it));
  const toAlbums = (v: unknown) =>
    (Array.isArray((v as { items?: YtmItem[] })?.items) ? (v as { items: YtmItem[] }).items : [])
      .map((it) => ytmAlbum(it));
  return {
    artist: {
      id: (data?.id as string) ?? fallbackId,
      name: (data?.name as string) ?? "Unknown artist",
      artworkUrl: bestThumb(data as YtmItem),
      description: (data?.description as string) ?? undefined,
      listeners: (data?.listeners as string) ?? undefined,
    } satisfies Artist & { description?: string; listeners?: string },
    topTracks: toTracks(data?.topSongs),
    albums: toAlbums(data?.albums),
    singles: toAlbums(data?.singles),
    videos: toTracks(data?.videos),
    related: toAlbums(data?.related),
    albumParams: ((data?.albums as { params?: string })?.params as string) ?? undefined,
    singleParams: ((data?.singles as { params?: string })?.params as string) ?? undefined,
    videoParams: ((data?.videos as { params?: string })?.params as string) ?? undefined,
  };
}

/** Normalize /lyrics/:id. */
export function normalizeLyrics(payload: unknown, trackId: string) {
  const data = ((payload as YtmEnvelope)?.data ?? payload) as Record<string, unknown>;
  const text = (data?.text as string) ?? "";
  const available = (data?.available as boolean) ?? text.length > 0;
  return {
    trackId,
    available,
    plain: text,
    syncedLrc: (data?.lrc as string) ?? (data?.synced as string) ?? "",
    hasSynced: !!(data?.lrc || data?.synced),
  };
}

/** Normalize /suggestions → string list (data is a plain string array). */
export function normalizeSuggestions(payload: unknown): string[] {
  const data = (payload as YtmEnvelope)?.data ?? payload;
  if (Array.isArray(data)) {
    return data
      .map((s) => (typeof s === "string" ? s : ((s as YtmItem)?.title ?? (s as YtmItem)?.name ?? "")))
      .filter((s): s is string => !!s);
  }
  if (data && typeof data === "object") {
    const v = (data as Record<string, unknown>).suggestions ?? (data as Record<string, unknown>).items;
    if (Array.isArray(v)) {
      return v
        .map((s) => (typeof s === "string" ? s : ((s as YtmItem)?.title ?? (s as YtmItem)?.name ?? "")))
        .filter((s): s is string => !!s);
    }
  }
  return [];
}

/** Normalize /related/:id → flatten sections into a track list. */
export function normalizeRelated(payload: unknown): Track[] {
  const data = ((payload as YtmEnvelope)?.data ?? payload) as Record<string, unknown>;
  const sections = (data?.sections as { items?: YtmItem[] }[]) ?? [];
  const out: Track[] = [];
  const seen = new Set<string>();
  for (const s of sections) {
    for (const it of s.items ?? []) {
      const t = (it.type ?? "").toLowerCase();
      if (t !== "song" && t !== "video") continue;
      const track = ytmTrack(it);
      if (!seen.has(track.id)) {
        seen.add(track.id);
        out.push(track);
      }
    }
  }
  return out;
}
