"use client";
// ─── Canvas audio visualizer ─────────────────────────────────────────────────
// Real spectrum via Web Audio AnalyserNode when available; falls back to a
// tasteful synthetic animation when AudioContext/autoplay restrictions make
// analysis impossible.
import { useEffect, useRef } from "react";

interface VisualizerProps {
  playing: boolean;
  className?: string;
  barColor?: string;
  glowColor?: string;
  barCount?: number;
}

// module-level singletons — a MediaElementSource may only be created once
let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let hooked = false;

function tryHook(): AnalyserNode | null {
  if (hooked) return analyser;
  hooked = true;
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const audioEl = document.querySelector("audio#flux-audio") as HTMLAudioElement | null;
    if (!audioEl) {
      hooked = false;
      return null;
    }
    ctx = new AC();
    const source = ctx.createMediaElementSource(audioEl);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    return analyser;
  } catch {
    ctx = null;
    analyser = null;
    return null;
  }
}

export function Visualizer({
  playing,
  className,
  barColor = "oklch(0.8 0.155 165 / 0.9)",
  glowColor = "oklch(0.82 0.13 195 / 0.55)",
  barCount = 48,
}: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const phaseRef = useRef(0);
  const playingRef = useRef(playing);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c2d = canvas.getContext("2d");
    if (!c2d) return;

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w < 8 || h < 8) {
        // not laid out yet — skip this frame
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      c2d.clearRect(0, 0, w, h);

      let levels: number[] = [];
      const an = playingRef.current ? tryHook() : analyser;
      if (an && ctx && ctx.state === "running" && playingRef.current) {
        const data = new Uint8Array(an.frequencyBinCount);
        an.getByteFrequencyData(data);
        const step = Math.max(1, Math.floor(data.length / barCount));
        for (let i = 0; i < barCount; i++) {
          let sum = 0;
          for (let j = 0; j < step; j++) sum += data[i * step + j] ?? 0;
          levels.push(sum / step / 255);
        }
      } else {
        phaseRef.current += playingRef.current ? 0.045 : 0.008;
        const t = phaseRef.current;
        for (let i = 0; i < barCount; i++) {
          const base =
            0.18 +
            0.5 * Math.abs(Math.sin(t * 1.9 + i * 0.38)) * Math.abs(Math.sin(t * 0.7 + i * 0.11)) +
            (playingRef.current ? 0.08 * Math.sin(t * 3.7 + i) : 0);
          levels.push(
            playingRef.current ? Math.max(0.05, Math.min(1, base)) : 0.07 + 0.03 * Math.sin(t + i * 0.3)
          );
        }
      }

      const gap = 2;
      const bw = Math.max(1, (w - gap * (barCount - 1)) / barCount);
      for (let i = 0; i < barCount; i++) {
        const lv = Math.max(0.04, levels[i]);
        const bh = Math.max(2, lv * h * 0.92);
        const x = i * (bw + gap);
        const y = h - bh;
        const grad = c2d.createLinearGradient(0, h, 0, y);
        grad.addColorStop(0, barColor);
        grad.addColorStop(1, glowColor);
        c2d.fillStyle = grad;
        const r = Math.max(0, Math.min(bw / 2, 2));
        c2d.beginPath();
        c2d.roundRect(x, y, bw, bh, [r, r, 1, 1]);
        c2d.fill();
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [barCount, barColor, glowColor]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
