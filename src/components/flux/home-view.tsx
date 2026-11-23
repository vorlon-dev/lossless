"use client";
// ─── Home view: hero, live trending, new releases, top artists, pipeline ─────
// Everything below the hero is powered by the live YTM metadata backend
// through /api/catalog (trending songs, new releases, top artists).
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
  Flame,
  TrendingUp,
  ListPlus,
  Music2,
  User,
} from "lucide-react";
import { Visualizer } from "./visualizer";
import { QualityBadge, formatDuration } from "./quality-badge";
import { useFlux } from "@/lib/store";
import { fetchCatalog } from "@/lib/api-client";
import type { CatalogResponse } from "@/lib/types";

const PIPELINE = [
  {
    icon: <Cloud size={18} className="text-cyan-300" />,
    title: "Cloudflare edge (free)",
    body: "This site + the public /api endpoints run as one Cloudflare Worker with static assets — unlimited asset requests, free-tier friendly API calls.",
  },
  {
    icon: <Server size={18} className="text-emerald-300" />,
    title: "YTM metadata backend",
    body: "Search, albums, artists, playlists, charts and lyrics come live from a YouTube Music InnerTube (WEB_REMIX) backend worker — always in sync with the catalog.",
  },
  {
    icon: <Radio size={18} className="text-fuchsia-300" />,
    title: "Stream resolver",
    body: "Playback is delegated to the resolver you configure via ANTRA_STREAM_TEMPLATE — /api/stream/{id} 302-redirects to it for every track.",
  },
];

export function HomeView() {
  const playTracks = useFlux((s) => s.playTracks);
  const addToQueue = useFlux((s) => s.addToQueue);
  const setView = useFlux((s) => s.setView);
  const setOpenAlbumId = useFlux((s) => s.setOpenAlbumId);
  const isPlaying = useFlux((s) => s.isPlaying);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const ctrl = new AbortController();
    fetchCatalog(ctrl.signal)
      .then((d) => {
        setCatalog(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
    return () => ctrl.abort();
  }, []);

  useEffect(() => load(), [load]);

  const playTrending = (index: number) => catalog && playTracks(catalog.trending, index);

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
              <Flame size={13} className="animate-[pulse_2.4s_ease-in-out_infinite]" />
              live · YouTube Music metadata backend
            </p>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
              Real music, real metadata,{" "}
              <span className="text-glow bg-gradient-to-r from-emerald-300 via-cyan-300 to-fuchsia-300 bg-clip-text text-transparent">
                engineered for the open web.
              </span>
            </h1>
            <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground sm:text-base">
              Search the full YouTube Music catalog, browse trending tracks and new releases,
              read lyrics — and expose a CORS-open REST API that any music app can plug into.
              All deployable on Cloudflare&rsquo;s free tier with your own backend.
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
              <div className="glass rounded-xl px-4 py-3">
                <p className="font-mono text-[12.5px] font-semibold text-emerald-300">
                  {catalog ? `${catalog.trending.length} trending` : "…"}
                </p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">live charts right now</p>
              </div>
              <div className="glass rounded-xl px-4 py-3">
                <p className="font-mono text-[12.5px] font-semibold text-cyan-300">
                  {catalog ? `${catalog.newReleases.length} new` : "…"}
                </p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">fresh album releases</p>
              </div>
              <div className="glass rounded-xl px-4 py-3">
                <p className="font-mono text-[12.5px] font-semibold text-fuchsia-300">
                  {catalog ? `${catalog.topArtists.length} artists` : "…"}
                </p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">top charts this week</p>
              </div>
              <div className="glass rounded-xl px-4 py-3">
                <p className="font-mono text-[12.5px] font-semibold text-emerald-300">CORS-open</p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">API usable from any app</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {error && (
        <section className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6">
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-red-300">
            Failed to reach the metadata backend: {error}
          </p>
        </section>
      )}

      {!catalog && !error && (
        <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Loader2 size={15} className="animate-spin" /> Loading live catalog from your backend…
          </div>
        </section>
      )}

      {/* ── trending now ─────────────────────────────────────────────────── */}
      {catalog && !!catalog.trending.length && (
        <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6" aria-label="Trending now">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <TrendingUp size={17} className="text-emerald-300" /> Trending now
            </h2>
            <button
              onClick={() => playTrending(0)}
              className="mono-label inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-emerald-300 transition-colors hover:bg-emerald-400/20"
            >
              <Play size={11} /> play all
            </button>
          </div>
          <div className="glass overflow-hidden rounded-2xl">
            <ul className="divide-y divide-white/5">
              {catalog.trending.slice(0, 10).map((t, i) => (
                <li
                  key={t.id}
                  className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/4 sm:px-4"
                >
                  <button
                    onClick={() => playTrending(i)}
                    className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
                    aria-label={`Play ${t.title}`}
                  >
                    {t.artworkUrl ? (
                      <img src={t.artworkUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-white/8">
                        <Music2 size={16} className="text-muted-foreground" />
                      </span>
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
                      <Play size={16} className="text-emerald-300" />
                    </span>
                  </button>
                  <span className="w-5 text-right font-mono text-[11px] text-muted-foreground/70">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium leading-tight">{t.title}</p>
                    <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                      {t.artists.join(", ")}
                      {t.views ? ` · ${t.views}` : ""}
                    </p>
                  </div>
                  <QualityBadge track={t} className="hidden sm:inline-flex" />
                  <span className="hidden w-11 text-right font-mono text-[11px] text-muted-foreground sm:block">
                    {formatDuration(t.durationMs)}
                  </span>
                  <button
                    onClick={() => addToQueue(t)}
                    className="rounded-lg p-2 text-muted-foreground opacity-0 transition-all hover:bg-white/10 hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label={`Add ${t.title} to queue`}
                  >
                    <ListPlus size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── new releases ─────────────────────────────────────────────────── */}
      {catalog && !!catalog.newReleases.length && (
        <section className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6" aria-label="New releases">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <Disc3 size={17} className="text-cyan-300" /> New releases
            </h2>
            <span className="mono-label text-muted-foreground">{catalog.newReleases.length} albums</span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {catalog.newReleases.slice(0, 10).map((a) => (
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
                  {a.artworkUrl ? (
                    <img
                      src={a.artworkUrl}
                      alt={`${a.title} cover art`}
                      className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                      loading="lazy"
                    />
                  ) : (
                    <span className="flex aspect-square w-full items-center justify-center bg-white/8">
                      <Disc3 size={22} className="text-muted-foreground" />
                    </span>
                  )}
                  <div className="p-3">
                    <p className="truncate text-[13.5px] font-medium">{a.title}</p>
                    <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                      {a.artists.join(", ") || "Album"}
                      {a.year ? ` · ${a.year}` : ""}
                    </p>
                  </div>
                </button>
              </motion.article>
            ))}
          </div>
        </section>
      )}

      {/* ── top artists ──────────────────────────────────────────────────── */}
      {catalog && !!catalog.topArtists.length && (
        <section className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6" aria-label="Top artists">
          <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold tracking-tight">
            <User size={17} className="text-fuchsia-300" /> Top artists
          </h2>
          <div className="flex flex-wrap gap-3">
            {catalog.topArtists.slice(0, 12).map((a) => (
              <button
                key={a.id || a.name}
                onClick={() => setView("search")}
                className="group flex items-center gap-3 rounded-2xl border border-white/8 bg-white/3 py-2 pl-2 pr-4 transition-colors hover:border-emerald-400/30 hover:bg-emerald-400/5"
                title={`Search ${a.name}`}
              >
                {a.artworkUrl ? (
                  <img src={a.artworkUrl} alt="" className="h-10 w-10 rounded-full object-cover" loading="lazy" />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/8">
                    <User size={16} className="text-muted-foreground" />
                  </span>
                )}
                <span className="text-left">
                  <span className="block text-[13px] font-medium">{a.name}</span>
                  <span className="block text-[11px] text-muted-foreground">tap to search</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

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
            <span className="font-medium text-foreground">Rights notice:</span> metadata and
            streams come from the backend and resolver you configure. You are responsible for
            holding the rights to anything you serve through this platform.
          </p>
        </div>
      </section>
    </div>
  );
}
