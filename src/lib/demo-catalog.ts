// ─── Antra Flux — built-in demo catalog ─────────────────────────────────────
// Used when no upstream Antra gateway is configured, so the whole site and
// every /api/* endpoint work out of the box. All audio is original,
// synthesized 16-bit/44.1kHz FLAC stored in /public/demo-audio. Cover art is
// procedurally generated and stored in /public/covers.
import type { Album, Artist, SearchResults, Track } from "./types";

const DEMO_CATALOG_VERSION = "1.0.0";

interface DemoTrackSpec {
  id: string;
  file: string;
  title: string;
  artists: string[];
  album: string;
  albumId: string;
  trackNumber: number;
  year: number;
  genres: string[];
  durationMs: number;
  isrc: string;
  lyrics?: { plain: string; syncedLrc: string };
}

const L1 = {
  plain:
    "City lights dissolve in chrome\nWe ride the meridian alone\nEvery neon tells a story\nEvery signal finds its home",
  syncedLrc:
    "[00:04.00] City lights dissolve in chrome\n[00:09.00] We ride the meridian alone\n[00:14.00] Every neon tells a story\n[00:19.00] Every signal finds its home",
};
const L2 = {
  plain:
    "Deep in the carrier wave\nA message out of time\nFrequency of longing\nModulated line",
  syncedLrc:
    "[00:06.00] Deep in the carrier wave\n[00:12.00] A message out of time\n[00:18.00] Frequency of longing\n[00:24.00] Modulated line",
};

const TRACK_SPECS: DemoTrackSpec[] = [
  { id: "demo-01", file: "neon-meridian",   title: "Neon Meridian",    artists: ["Kaelo"],         album: "Neon Meridian",  albumId: "al-01", trackNumber: 1, year: 2026, genres: ["Synthwave", "Electronic"],  durationMs: 44000, isrc: "DMA0016000001" },
  { id: "demo-02", file: "chrome-sunrise",  title: "Chrome Sunrise",   artists: ["Kaelo"],         album: "Neon Meridian",  albumId: "al-01", trackNumber: 2, year: 2026, genres: ["Synthwave", "Electronic"],  durationMs: 40000, isrc: "DMA0016000002" },
  { id: "demo-03", file: "midnight-courier",title: "Midnight Courier", artists: ["Kaelo"],         album: "Neon Meridian",  albumId: "al-01", trackNumber: 3, year: 2026, genres: ["Synthwave", "Electronic"],  durationMs: 46000, isrc: "DMA0016000003" },
  { id: "demo-04", file: "afterglow-drive", title: "Afterglow Drive",  artists: ["Kaelo"],         album: "Neon Meridian",  albumId: "al-01", trackNumber: 4, year: 2026, genres: ["Synthwave", "Electronic"],  durationMs: 38000, isrc: "DMA0016000004" },
  { id: "demo-05", file: "deep-signal",     title: "Deep Signal",      artists: ["Vector Fields"], album: "Deep Signal",    albumId: "al-02", trackNumber: 1, year: 2025, genres: ["Ambient Techno"],           durationMs: 52000, isrc: "DMA0015000005" },
  { id: "demo-06", file: "carrier-wave",    title: "Carrier Wave",     artists: ["Vector Fields"], album: "Deep Signal",    albumId: "al-02", trackNumber: 2, year: 2025, genres: ["Ambient Techno"],           durationMs: 48000, isrc: "DMA0015000006", lyrics: L2 },
  { id: "demo-07", file: "ionosphere",      title: "Ionosphere",       artists: ["Vector Fields"], album: "Deep Signal",    albumId: "al-02", trackNumber: 3, year: 2025, genres: ["Ambient Techno"],           durationMs: 50000, isrc: "DMA0015000007" },
  { id: "demo-08", file: "aurora-protocol", title: "Aurora Protocol",  artists: ["Ilya Voss"],     album: "Aurora Protocol",albumId: "al-03", trackNumber: 1, year: 2026, genres: ["Cinematic", "Ambient"],     durationMs: 54000, isrc: "DMA0016000008", lyrics: L1 },
  { id: "demo-09", file: "polar-veil",      title: "Polar Veil",       artists: ["Ilya Voss"],     album: "Aurora Protocol",albumId: "al-03", trackNumber: 2, year: 2026, genres: ["Cinematic", "Ambient"],     durationMs: 46000, isrc: "DMA0016000009" },
  { id: "demo-10", file: "solar-lattice",   title: "Solar Lattice",    artists: ["Ilya Voss"],     album: "Aurora Protocol",albumId: "al-03", trackNumber: 3, year: 2026, genres: ["Cinematic", "Ambient"],     durationMs: 42000, isrc: "DMA0016000010" },
];

function demoFormat() {
  return { codec: "FLAC", bitDepth: 16, sampleRateHz: 44100, lossless: true };
}

export function demoTrack(spec: DemoTrackSpec): Track {
  const fmt = demoFormat();
  return {
    id: spec.id,
    title: spec.title,
    artists: spec.artists,
    album: spec.album,
    albumId: spec.albumId,
    durationMs: spec.durationMs,
    trackNumber: spec.trackNumber,
    discNumber: 1,
    releaseYear: spec.year,
    genres: spec.genres,
    artworkUrl: `/covers/${spec.file}.jpg`,
    isrc: spec.isrc,
    explicit: false,
    format: fmt,
    qualityLabel: "FLAC 16-bit/44.1kHz",
    hiRes: false,
    streamUrl: `/api/stream/${spec.id}`,
    source: "demo",
    lyrics: spec.lyrics,
  };
}

export const DEMO_TRACKS: Track[] = TRACK_SPECS.map(demoTrack);

export const DEMO_ALBUMS: Album[] = [
  { id: "al-01", title: "Neon Meridian",   artists: ["Kaelo"],         year: 2026, genres: ["Synthwave"],      artworkUrl: "/covers/neon-meridian.jpg",   trackCount: 4 },
  { id: "al-02", title: "Deep Signal",     artists: ["Vector Fields"], year: 2025, genres: ["Ambient Techno"], artworkUrl: "/covers/deep-signal.jpg",     trackCount: 3 },
  { id: "al-03", title: "Aurora Protocol", artists: ["Ilya Voss"],     year: 2026, genres: ["Cinematic"],      artworkUrl: "/covers/aurora-protocol.jpg", trackCount: 3 },
].map((a) => ({
  ...a,
  tracks: DEMO_TRACKS.filter((t) => t.albumId === a.id),
}));

export const DEMO_ARTISTS: Artist[] = [
  { id: "ar-01", name: "Kaelo",         artworkUrl: "/covers/neon-meridian.jpg",   albumCount: 1, trackCount: 4 },
  { id: "ar-02", name: "Vector Fields", artworkUrl: "/covers/deep-signal.jpg",     albumCount: 1, trackCount: 3 },
  { id: "ar-03", name: "Ilya Voss",     artworkUrl: "/covers/aurora-protocol.jpg", albumCount: 1, trackCount: 3 },
];

export function demoSearch(
  query: string,
  kind: "song" | "album" | "artist",
  limit = 25
): SearchResults {
  const q = query.trim().toLowerCase();
  const empty: SearchResults = { tracks: [], albums: [], artists: [] };
  if (!q) {
    // empty query → browse everything
    return {
      tracks: DEMO_TRACKS.slice(0, limit),
      albums: DEMO_ALBUMS,
      artists: DEMO_ARTISTS,
    };
  }
  const match = (s?: string) => (s ?? "").toLowerCase().includes(q);

  const tracks = DEMO_TRACKS.filter(
    (t) =>
      match(t.title) ||
      t.artists.some(match) ||
      match(t.album) ||
      (t.genres ?? []).some(match)
  );
  const albums = DEMO_ALBUMS.filter(
    (a) => match(a.title) || a.artists.some(match) || (a.genres ?? []).some(match)
  );
  const artists = DEMO_ARTISTS.filter((a) => match(a.name));

  if (kind === "song")   return { tracks: tracks.slice(0, limit), albums: [], artists: [] };
  if (kind === "album")  return { tracks: [], albums: albums.slice(0, limit), artists: [] };
  if (kind === "artist") return { tracks: [], albums: [], artists: artists.slice(0, limit) };
  return {
    tracks: tracks.slice(0, limit),
    albums: albums.slice(0, limit),
    artists: artists.slice(0, limit),
  };
}

export function demoTrackById(id: string): Track | undefined {
  return DEMO_TRACKS.find((t) => t.id === id);
}

export function demoAlbumById(id: string): Album | undefined {
  return DEMO_ALBUMS.find((a) => a.id === id);
}

export function demoFileFor(id: string): string | undefined {
  return TRACK_SPECS.find((s) => s.id === id)?.file;
}

export const DEMO_VERSION = DEMO_CATALOG_VERSION;
