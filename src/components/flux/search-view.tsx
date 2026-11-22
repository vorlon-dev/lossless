"use client";
// ─── Search view: instant, debounced, abortable search across the catalog ────
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Play,
  Disc3,
  User,
  Music2,
  Loader2,
  ListPlus,
  X,
} from "lucide-react";
import { useFlux } from "@/lib/store";
import { fetchSearch } from "@/lib/api-client";
import { QualityBadge, formatDuration } from "./quality-badge";
import type { Album, Artist, SearchResults, Track } from "@/lib/types";

type Kind = "all" | "song" | "album" | "artist";

const KINDS: { id: Kind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "song", label: "Songs" },
  { id: "album", label: "Albums" },
  { id: "artist", label: "Artists" },
];

const SUGGESTIONS = ["Neon", "Deep Signal", "Kaelo", "Aurora", "Ilya Voss", "Ambient"];

export function SearchView() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientGateway = useFlux((s) => s.clientGateway);
  const playTrack = useFlux((s) => s.playTrack);
  const addToQueue = useFlux((s) => s.addToQueue);
  const setOpenAlbumId = useFlux((s) => s.setOpenAlbumId);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      setError(null);
      const gw = clientGateway;

      if (kind === "all") {
        Promise.all([
          fetchSearch({ q: query, kind: "song", limit: 30, gateway: gw, signal: ctrl.signal }),
          fetchSearch({ q: query, kind: "album", limit: 12, gateway: gw, signal: ctrl.signal }),
          fetchSearch({ q: query, kind: "artist", limit: 8, gateway: gw, signal: ctrl.signal }),
        ])
          .then(([t2, a, ar]) => {
            setResults({ tracks: t2.tracks, albums: a.albums, artists: ar.artists });
            setError(null);
          })
          .catch((e: Error) => {
            if (e.name !== "AbortError") {
              setError(e.message);
              setResults(null);
            }
          })
          .finally(() => setLoading(false));
      } else {
        fetchSearch({ q: query, kind, limit: 30, gateway: gw, signal: ctrl.signal })
          .then((r) => {
            setResults(r);
            setError(null);
          })
          .catch((e: Error) => {
            if (e.name !== "AbortError") {
              setError(e.message);
              setResults(null);
            }
          })
          .finally(() => setLoading(false));
      }
    }, query ? 260 : 0);
    return () => clearTimeout(t);
  }, [query, kind, clientGateway]);

  const hasResults =
    results && (results.tracks.length || results.albums.length || results.artists.length);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      {/* search box */}
      <div className="relative">
        <Search
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search songs, albums, artists…"
          className="h-13 w-full rounded-2xl border border-white/12 bg-white/5 py-3.5 pl-12 pr-11 text-[15px] placeholder:text-muted-foreground/70 focus:border-emerald-400/50 focus:bg-white/8 focus:outline-none focus:ring-2 focus:ring-emerald-400/25 transition-all"
          aria-label="Search the music catalog"
          autoFocus
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
            aria-label="Clear search"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* kind tabs + suggestions */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {KINDS.map((k) => (
          <button
            key={k.id}
            onClick={() => setKind(k.id)}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] transition-colors border ${
              kind === k.id
                ? "border-emerald-400/35 bg-emerald-400/12 text-emerald-300"
                : "border-white/10 bg-white/4 text-muted-foreground hover:text-foreground"
            }`}
          >
            {k.label}
          </button>
        ))}
        {!query && (
          <span className="ml-2 hidden items-center gap-1.5 sm:flex">
            <span className="mono-label text-muted-foreground/70">try</span>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setQuery(s)}
                className="rounded-full border border-white/8 bg-white/3 px-2.5 py-1 text-[11.5px] text-muted-foreground hover:border-emerald-400/30 hover:text-emerald-300"
              >
                {s}
              </button>
            ))}
          </span>
        )}
        <span className="ml-auto flex items-center gap-2 text-[11.5px] text-muted-foreground">
          {loading && <Loader2 size={13} className="animate-spin" />}
          {clientGateway ? "direct gateway" : "via /api/search"}
        </span>
      </div>

      {error && (
        <p className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-red-300">
          {error}
        </p>
      )}

      {/* ── artists row ──────────────────────────────────────────────────── */}
      {hasResults && !!results.artists.length && (
        <section className="mt-8" aria-label="Artists">
          <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
            <User size={14} /> Artists
          </h2>
          <div className="flex flex-wrap gap-3">
            {results.artists.map((a: Artist) => (
              <button
                key={a.id || a.name}
                onClick={() => setQuery(a.name)}
                className="group flex items-center gap-3 rounded-2xl border border-white/8 bg-white/3 py-2 pl-2 pr-4 transition-colors hover:border-emerald-400/30 hover:bg-emerald-400/5"
              >
                {a.artworkUrl ? (
                   
                  <img
                    src={a.artworkUrl}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/8">
                    <User size={16} className="text-muted-foreground" />
                  </span>
                )}
                <span className="text-left">
                  <span className="block text-[13px] font-medium">{a.name}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {a.albumCount ?? 0} album{(a.albumCount ?? 0) === 1 ? "" : "s"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── albums row ───────────────────────────────────────────────────── */}
      {hasResults && !!results.albums.length && (
        <section className="mt-8" aria-label="Albums">
          <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
            <Disc3 size={14} /> Albums
          </h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {results.albums.map((a: Album) => (
              <button
                key={a.id}
                onClick={() => setOpenAlbumId(a.id)}
                className="group overflow-hidden rounded-xl border border-white/8 bg-white/3 text-left transition-colors hover:border-emerald-400/30"
              >
                { }
                <img
                  src={a.artworkUrl}
                  alt=""
                  className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.05]"
                  loading="lazy"
                />
                <div className="p-2.5">
                  <p className="truncate text-[12.5px] font-medium">{a.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {a.artists.join(", ")}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── tracks ───────────────────────────────────────────────────────── */}
      {hasResults && !!results.tracks.length && (
        <section className="mt-8" aria-label="Songs">
          <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
            <Music2 size={14} /> Songs
          </h2>
          <div className="glass overflow-hidden rounded-2xl">
            <ul className="divide-y divide-white/5">
              {results.tracks.map((t: Track, i: number) => (
                <motion.li
                  key={`${t.id}-${i}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/4 sm:px-4"
                >
                  <button
                    onClick={() => playTrack(t)}
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
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium leading-tight">
                      {t.title}
                      {t.explicit && (
                        <span className="ml-1.5 rounded bg-white/10 px-1 text-[9px] font-bold align-middle text-muted-foreground">
                          E
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                      {t.artists.join(", ")}
                      {t.album ? ` — ${t.album}` : ""}
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
                </motion.li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* empty state */}
      {!loading && !error && results && !hasResults && (
        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/4">
            <Search size={22} className="text-muted-foreground" />
          </span>
          <p className="text-[14px] font-medium">No matches for “{query}”</p>
          <p className="max-w-sm text-[12.5px] text-muted-foreground">
            {clientGateway
              ? "Your gateway returned no results. Check that its sources are configured and searchable."
              : "This is the built-in demo catalog. Connect your Antra gateway in Settings to search your real library."}
          </p>
        </div>
      )}

      {!results && !loading && !error && (
        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <Loader2 size={18} className="animate-spin text-muted-foreground" />
          <p className="text-[12.5px] text-muted-foreground">Loading catalog…</p>
        </div>
      )}
    </div>
  );
}
