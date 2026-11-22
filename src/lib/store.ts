"use client";
// ─── Antra Flux — player + app store (zustand) ──────────────────────────────
import { create } from "zustand";
import type { Track } from "./types";

export type View = "home" | "search" | "api" | "settings";
export type RepeatMode = "off" | "all" | "one";

interface FluxState {
  // app
  view: View;
  setView: (v: View) => void;
  openAlbumId: string | null;
  setOpenAlbumId: (id: string | null) => void;
  // gateway override (per-browser, stored in localStorage)
  clientGateway: string | null;
  setClientGateway: (url: string | null) => void;
  // player
  queue: Track[];
  currentIndex: number;
  isPlaying: boolean;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  currentTime: number;
  duration: number;
  seekRequest: number | null; // seconds; consumed by PlayerBar
  playTracks: (tracks: Track[], index?: number) => void;
  playTrack: (t: Track) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  requestSeek: (seconds: number) => void;
  clearSeek: () => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  addToQueue: (t: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  reportTime: (t: number, d: number) => void;
  _shuffleOrder: number[];
}

// ── audio element singleton (registered by the declarative <audio> in PlayerBar) ──
let audio: HTMLAudioElement | null = null;
export function setAudioEl(el: HTMLAudioElement | null) {
  audio = el;
}
export function getAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  return audio;
}

function shuffled(n: number, firstIndex: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i).filter((i) => i !== firstIndex);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return [firstIndex, ...arr];
}

export const useFlux = create<FluxState>((set, get) => ({
  view: "home",
  setView: (v) => set({ view: v }),
  openAlbumId: null,
  setOpenAlbumId: (id) => set({ openAlbumId: id }),

  clientGateway: null,
  setClientGateway: (url) => set({ clientGateway: url }),

  queue: [],
  currentIndex: -1,
  isPlaying: false,
  volume: 0.85,
  muted: false,
  shuffle: false,
  repeat: "off",
  currentTime: 0,
  duration: 0,
  seekRequest: null,
  _shuffleOrder: [],

  playTracks: (tracks, index = 0) => {
    if (!tracks.length) return;
    const a = getAudio();
    const shuffle = get().shuffle;
    const order = shuffle ? shuffled(tracks.length, index) : null;
    set({
      queue: tracks,
      currentIndex: index,
      _shuffleOrder: order ?? [],
      isPlaying: true,
    });
    const t = tracks[index];
    if (a && t) {
      a.src = resolveStreamSrc(t);
      a.volume = get().muted ? 0 : get().volume;
      a.play().catch(() => set({ isPlaying: false }));
    }
  },

  playTrack: (t) => {
    const q = get().queue;
    const idx = q.findIndex((x) => x.id === t.id);
    if (idx >= 0) {
      get().playTracks(q, idx);
    } else {
      get().playTracks([t], 0);
    }
  },

  togglePlay: () => {
    const a = getAudio();
    const { isPlaying, queue, currentIndex } = get();
    if (!a || !queue.length || currentIndex < 0) return;
    if (isPlaying) {
      a.pause();
      set({ isPlaying: false });
    } else {
      a.play().catch(() => set({ isPlaying: false }));
      set({ isPlaying: true });
    }
  },

  next: () => {
    const { queue, currentIndex, shuffle, _shuffleOrder, repeat } = get();
    if (!queue.length) return;
    let nextIdx: number;
    if (shuffle && _shuffleOrder.length) {
      const pos = _shuffleOrder.indexOf(currentIndex);
      if (pos >= 0 && pos < _shuffleOrder.length - 1) nextIdx = _shuffleOrder[pos + 1];
      else if (repeat === "all") nextIdx = _shuffleOrder[0];
      else {
        const a = getAudio();
        a?.pause();
        set({ isPlaying: false });
        return;
      }
    } else {
      if (currentIndex < queue.length - 1) nextIdx = currentIndex + 1;
      else if (repeat === "all") nextIdx = 0;
      else {
        const a = getAudio();
        a?.pause();
        set({ isPlaying: false });
        return;
      }
    }
    set({ currentIndex: nextIdx, isPlaying: true });
    const a = getAudio();
    const t = queue[nextIdx];
    if (a && t) {
      a.src = resolveStreamSrc(t);
      a.play().catch(() => set({ isPlaying: false }));
    }
  },

  prev: () => {
    const { queue, currentIndex } = get();
    if (!queue.length) return;
    const a = getAudio();
    if (a && a.currentTime > 3) {
      get().requestSeek(0);
      return;
    }
    const prevIdx = currentIndex > 0 ? currentIndex - 1 : queue.length - 1;
    set({ currentIndex: prevIdx, isPlaying: true });
    const t = queue[prevIdx];
    if (a && t) {
      a.src = resolveStreamSrc(t);
      a.play().catch(() => set({ isPlaying: false }));
    }
  },

  requestSeek: (seconds) => set({ seekRequest: seconds }),
  clearSeek: () => set({ seekRequest: null }),

  setVolume: (v) => {
    const a = getAudio();
    if (a) a.volume = v;
    set({ volume: v, muted: v === 0 });
  },

  toggleMute: () => {
    const a = getAudio();
    const muted = !get().muted;
    if (a) a.volume = muted ? 0 : get().volume;
    set({ muted });
  },

  toggleShuffle: () => {
    const { shuffle, queue, currentIndex } = get();
    const nextShuffle = !shuffle;
    set({
      shuffle: nextShuffle,
      _shuffleOrder: nextShuffle && queue.length ? shuffled(queue.length, currentIndex) : [],
    });
  },

  cycleRepeat: () =>
    set((s) => ({
      repeat: s.repeat === "off" ? "all" : s.repeat === "all" ? "one" : "off",
    })),

  addToQueue: (t) => {
    const q = get().queue;
    if (q.some((x) => x.id === t.id)) return;
    set({ queue: [...q, t] });
  },

  removeFromQueue: (index) => {
    const { queue, currentIndex } = get();
    const newQueue = queue.filter((_, i) => i !== index);
    let newIdx = currentIndex;
    if (index < currentIndex) newIdx -= 1;
    else if (index === currentIndex) newIdx = Math.min(currentIndex, newQueue.length - 1);
    set({ queue: newQueue, currentIndex: newIdx });
  },

  clearQueue: () => {
    const a = getAudio();
    a?.pause();
    set({ queue: [], currentIndex: -1, isPlaying: false, currentTime: 0, duration: 0 });
  },

  reportTime: (t, d) => set({ currentTime: t, duration: d }),
}));

// ── stream URL resolution (demo /api/stream/:id or direct gateway) ───────────
export function resolveStreamSrc(t: Track): string {
  const gw = useFlux.getState().clientGateway;
  if (gw) {
    // direct-to-gateway mode: keep the gateway's absolute stream path
    if (t.streamUrl.startsWith("http")) return t.streamUrl;
    return `${gw.replace(/\/+$/, "")}/stream/${encodeURIComponent(t.id)}`;
  }
  return t.streamUrl;
}
