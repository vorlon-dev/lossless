"use client";
// ─── Lyrics panel: synced LRC highlight + plain text fallback ────────────────
import { useEffect, useMemo, useRef, useState } from "react";
import { Mic2, X } from "lucide-react";
import { useFlux } from "@/lib/store";
import type { Track } from "@/lib/types";

interface LrcLine {
  time: number;
  text: string;
}

function parseLrc(lrc: string): LrcLine[] {
  const out: LrcLine[] = [];
  for (const raw of lrc.split("\n")) {
    const matches = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    if (!matches.length) continue;
    const text = raw.replace(/\[(\d+):(\d+(?:\.\d+)?)\]/g, "").trim();
    for (const m of matches) {
      const time = parseInt(m[1], 10) * 60 + parseFloat(m[2]);
      out.push({ time, text });
    }
  }
  return out.sort((a, b) => a.time - b.time);
}

function useLyrics(track: Track | null): { plain: string; lrc: LrcLine[]; loading: boolean } {
  const [loaded, setLoaded] = useState<{ id: string; plain?: string; syncedLrc?: string } | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const trackId = track?.id ?? null;

  useEffect(() => {
    if (!trackId) return;
    if (loaded?.id === trackId || failed.includes(trackId)) return;
    const ctrl = new AbortController();
    fetch(`/api/lyrics/${encodeURIComponent(trackId)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && (d.plain || d.syncedLrc)) setLoaded({ id: trackId, plain: d.plain, syncedLrc: d.syncedLrc });
        else setFailed((f) => (f.includes(trackId) ? f : [...f, trackId]));
      })
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [trackId, loaded, failed]);

  const loading = trackId != null && loaded?.id !== trackId && !failed.includes(trackId);
  const plain = track?.lyrics?.plain ?? (loaded?.id === trackId ? loaded?.plain ?? "" : "");
  const synced =
    track?.lyrics?.syncedLrc ?? (loaded?.id === trackId ? loaded?.syncedLrc ?? "" : "");
  const lrc = useMemo(() => (synced ? parseLrc(synced) : []), [synced]);
  return { plain, lrc, loading };
}

export function LyricsPanel({ onClose }: { onClose: () => void }) {
  const queue = useFlux((s) => s.queue);
  const currentIndex = useFlux((s) => s.currentIndex);
  const currentTime = useFlux((s) => s.currentTime);
  const track = queue[currentIndex] ?? null;
  const { plain, lrc, loading } = useLyrics(track);
  const listRef = useRef<HTMLDivElement>(null);

  const activeIdx = useMemo(() => {
    if (!lrc.length) return -1;
    let idx = -1;
    for (let i = 0; i < lrc.length; i++) {
      if (lrc[i].time <= currentTime + 0.25) idx = i;
      else break;
    }
    return idx;
  }, [lrc, currentTime]);

  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-line="${activeIdx}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIdx]);

  return (
    <div className="glass-strong relative mx-auto w-full max-w-6xl overflow-hidden rounded-t-2xl border-x border-t border-white/10">
      <div className="flex items-center justify-between border-b border-white/8 px-5 py-2.5">
        <p className="mono-label flex items-center gap-2 text-muted-foreground">
          <Mic2 size={13} className="text-emerald-300" />
          lyrics{track ? ` — ${track.title}` : ""}
        </p>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
          aria-label="Close lyrics"
        >
          <X size={15} />
        </button>
      </div>
      <div ref={listRef} className="max-h-44 overflow-y-auto px-5 py-3">
        {loading && <p className="py-3 text-[12.5px] text-muted-foreground">Loading lyrics…</p>}
        {!loading && lrc.length > 0 && (
          <div className="space-y-1.5">
            {lrc.map((line, i) => (
              <p
                key={i}
                data-line={i}
                className={`text-[13.5px] transition-all duration-300 ${
                  i === activeIdx
                    ? "font-medium text-emerald-300 text-glow"
                    : i < activeIdx
                      ? "text-muted-foreground/45"
                      : "text-muted-foreground/80"
                }`}
              >
                {line.text || "♪"}
              </p>
            ))}
          </div>
        )}
        {!loading && !lrc.length && plain && (
          <p className="whitespace-pre-line py-1 text-[13.5px] leading-relaxed text-muted-foreground">
            {plain}
          </p>
        )}
        {!loading && !lrc.length && !plain && (
          <p className="py-3 text-[12.5px] text-muted-foreground">
            No lyrics available for this track. (Live mode: the gateway serves synced LRC when the
            source provides it.)
          </p>
        )}
      </div>
    </div>
  );
}
