"use client";
// ─── Home view: hero, featured albums, artists, how-it-works ────────────────
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Search as SearchIcon,
  Code2,
  Radio,
  Server,
  Cloud,
  ShieldCheck,
  Disc3,
  Loader2,
} from "lucide-react";
import { Visualizer } from "./visualizer";
import { QualityBadge, formatDuration } from "./quality-badge";
import { useFlux } from "@/lib/store";
import { fetchCatalog } from "@/lib/api-client";
import type { Album } from "@/lib/types";

const QUALITY_POINTS = [
  { k: "FLAC / ALAC", v: "bit-perfect lossless codecs" },
  { k: "24-bit · 192 kHz", v: "hi-res ceiling set by your sources" },
  { k: "Gapless + Range", v: "HTTP Range seeking on every stream" },
  { k: "CORS-open API", v: "usable from any app or player" },
];

const PIPELINE = [
  {
    icon: <Cloud size={18} className="text-cyan-300" />,
    title: "Cloudflare edge (free)",
    body: "This site + the public /api endpoints run as Cloudflare Pages and Pages Functions — static assets at the edge, free tier friendly.",
  },
  {
    icon: <Server size={18} className="text-emerald-300" />,
    title: "Antra gateway",
    body: "A small Python service (included in /gateway) wraps the open-source Antra engine: catalog search, metadata, stream resolution.",
  },
  {
    icon: <Radio size={18} className="text-fuchsia-300" />,
    title: "Sources & streams",
    body: "The gateway resolves lossless streams from the sources you configure (Tidal/Qobuz/Deezer mirrors via Antra's endpoint manifest).",
  },
];

export function HomeView() {
  const playTracks = useFlux((s) => s.playTracks);
  const setView = useFlux((s) => s.setView);
  const setOpenAlbumId = useFlux((s) => s.setOpenAlbumId);
  const isPlaying = useFlux((s) => s.isPlaying);
  const [albums, setAlbums] = useState<Album[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const ctrl = new AbortController();
    fetchCatalog(ctrl.signal)
      .then((d) => setAlbums(d.albums))
      .catch((e) => setError(e.message));
    return () => ctrl.abort();
  }, []);

  useEffect(() => load(), [load]);

  const playAlbum = (a: Album) => playTracks(a.tracks, 0);

  return (
    <div className="flex flex-col">
      {/* ── hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="grid-bg absolute inset-0 opacity-60" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-14 sm:px-6 sm:pb-14 sm:pt-20">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="max-w-2xl"
          >
            <p className="mono-label mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/8 px-3 py-1 text-emerald-300">
              <Disc3 size={13} className="animate-[spin_3.2s_linear_infinite]" />
              powered by the open Antra engine
            </p>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
              Hi-res lossless streaming,{" "}
              <span className="text-glow bg-gradient-to-r from-emerald-300 via-cyan-300 to-fuchsia-300 bg-clip-text text-transparent">
                engineered for the open web.
              </span>
            </h1>
            <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground sm:text-base">
              Search the catalog, stream bit-perfect FLAC/ALAC in the browser, and expose a
              CORS-open REST API that any music app can plug into — all deployable on Cloudflare&rsquo;s
              free tier with your own self-hosted Antra gateway.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                onClick={() => setView("search")}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-2.5 text-[14px] font-semibold text-emerald-950 shadow-[0_0_28px_oklch(0.8_0.155_165/0.35)] transition-all hover:bg-emerald-300 hover:shadow-[0_0_36px_oklch(0.8_0.155_165/0.5)]"
              >
                <SearchIcon size={16} />
                Start listening
              </button>
              <button
                onClick={() => setView("api")}
                className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/5 px-5 py-2.5 text-[14px] font-medium text-foreground transition-colors hover:bg-white/10"
              >
                <Code2 size={16} />
                API for your music app
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.7 }}
            className="mt-10"
          >
            <Visualizer
              playing={isPlaying}
              barCount={64}
              className="h-[74px] w-full"
            />
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {QUALITY_POINTS.map((q) => (
                <div key={q.k} className="glass rounded-xl px-4 py-3">
                  <p className="font-mono text-[12.5px] font-semibold text-emerald-300">{q.k}</p>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{q.v}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── featured albums ──────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6" aria-label="Featured albums">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Featured albums</h2>
          {albums && (
            <span className="mono-label text-muted-foreground">{albums.length} in catalog</span>
          )}
        </div>
        {error && (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-red-300">
            Failed to load catalog: {error}
          </p>
        )}
        {!albums && !error && (
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Loader2 size={15} className="animate-spin" /> Loading catalog…
          </div>
        )}
        {albums && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {albums.map((a) => (
              <motion.article
                key={a.id}
                whileHover={{ y: -4 }}
                className="group relative overflow-hidden rounded-2xl border border-white/8 bg-white/3"
              >
                <button
                  className="block w-full text-left focus-visible:outline-2 focus-visible:outline-ring"
                  onClick={() => setOpenAlbumId(a.id)}
                  aria-label={`Open album ${a.title}`}
                >
                  { }
                  <img
                    src={a.artworkUrl}
                    alt={`${a.title} cover art`}
                    className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                    loading="lazy"
                  />
                  <div className="p-3">
                    <p className="truncate text-[13.5px] font-medium">{a.title}</p>
                    <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                      {a.artists.join(", ")} · {a.year}
                    </p>
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playAlbum(a);
                  }}
                  className="absolute right-2.5 top-2.5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400 text-emerald-950 shadow-[0_0_24px_oklch(0.8_0.155_165/0.5)] transition-all hover:bg-emerald-300 md:translate-y-1 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100"
                  aria-label={`Play album ${a.title}`}
                >
                  <Play size={16} className="ml-0.5" />
                </button>
              </motion.article>
            ))}
          </div>
        )}
      </section>

      {/* ── pipeline / how it works ──────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6" aria-label="Architecture">
        <h2 className="mb-5 text-lg font-semibold tracking-tight">
          How the platform fits together
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {PIPELINE.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="glass relative rounded-2xl p-5"
            >
              <span className="absolute right-4 top-4 mono-label text-muted-foreground/60">
                0{i + 1}
              </span>
              <div className="mb-3 inline-flex rounded-xl border border-white/10 bg-white/5 p-2.5">
                {p.icon}
              </div>
              <h3 className="text-[14.5px] font-semibold">{p.title}</h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{p.body}</p>
            </motion.div>
          ))}
        </div>
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-white/8 bg-white/3 px-4 py-3">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-300" />
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Rights notice:</span> this platform
            streams only what your own gateway and configured sources serve. You are responsible
            for holding the rights to anything you stream through it. The demo catalog is original,
            synthesized audio generated for this project.
          </p>
        </div>
      </section>
    </div>
  );
}
