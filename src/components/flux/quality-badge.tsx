"use client";
// ─── Quality badge (codec + hi-res tag) ──────────────────────────────────────
import { cn } from "@/lib/utils";
import type { Track } from "@/lib/types";

export function QualityBadge({ track, className = "" }: { track: Track; className?: string }) {
  const lossless = track.format.lossless;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10px] leading-4 tracking-wide whitespace-nowrap",
        lossless
          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
          : "border-amber-400/30 bg-amber-400/10 text-amber-300",
        className
      )}
      title={`${track.qualityLabel} — ${lossless ? "lossless" : "lossy"}`}
    >
      {lossless && (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_oklch(0.8_0.155_165)]" />
      )}
      {track.qualityLabel}
      {track.hiRes && (
        <span className="rounded bg-fuchsia-400/15 px-1 font-semibold text-fuchsia-300">
          HI-RES
        </span>
      )}
    </span>
  );
}

export function formatDuration(ms: number | undefined): string {
  if (!ms || ms <= 0) return "--:--";
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function formatSeconds(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}
