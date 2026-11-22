"use client";
// ─── Album modal: artwork, metadata, tracklist, play/queue actions ───────────
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Play, ListPlus, Loader2, Disc3 } from "lucide-react";
import { useFlux } from "@/lib/store";
import { fetchAlbum } from "@/lib/api-client";
import { QualityBadge, formatDuration } from "./quality-badge";
import type { Album } from "@/lib/types";

export function AlbumModal() {
  const openAlbumId = useFlux((s) => s.openAlbumId);
  const setOpenAlbumId = useFlux((s) => s.setOpenAlbumId);
  const clientGateway = useFlux((s) => s.clientGateway);
  const playTracks = useFlux((s) => s.playTracks);
  const addToQueue = useFlux((s) => s.addToQueue);
  const [loaded, setLoaded] = useState<{ id: string | null; album: Album | null; error: string | null }>({
    id: null,
    album: null,
    error: null,
  });

  useEffect(() => {
    if (!openAlbumId) return;
    const ctrl = new AbortController();
    fetchAlbum(openAlbumId, clientGateway, ctrl.signal)
      .then((a) => setLoaded({ id: openAlbumId, album: a, error: null }))
      .catch((e: Error) => {
        if (e.name !== "AbortError") setLoaded({ id: openAlbumId, album: null, error: e.message });
      });
    return () => ctrl.abort();
  }, [openAlbumId, clientGateway]);

  const album = openAlbumId && loaded.id === openAlbumId ? loaded.album : null;
  const error = openAlbumId && loaded.id === openAlbumId ? loaded.error : null;
  const loading = openAlbumId != null && loaded.id !== openAlbumId;

  return (
    <Dialog open={!!openAlbumId} onOpenChange={(o) => !o && setOpenAlbumId(null)}>
      <DialogContent className="glass-strong max-h-[85vh] overflow-hidden rounded-2xl border-white/10 p-0 sm:max-w-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{album?.title ?? "Album"}</DialogTitle>
        </DialogHeader>
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-muted-foreground">
            <Loader2 size={16} className="animate-spin" /> Loading album…
          </div>
        )}
        {error && (
          <div className="px-6 py-14 text-center">
            <p className="text-[13px] text-red-300">{error}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              The album id may belong to a different backend than the one currently connected.
            </p>
          </div>
        )}
        {album && (
          <div className="flex max-h-[85vh] flex-col">
            <div className="flex gap-4 border-b border-white/8 p-5">
              {album.artworkUrl && (
                 
                <img
                  src={album.artworkUrl}
                  alt={`${album.title} cover`}
                  className="h-28 w-28 shrink-0 rounded-xl border border-white/10 object-cover sm:h-36 sm:w-36"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="mono-label mb-1.5 text-emerald-300/80">
                  <Disc3 size={11} className="mr-1 inline" /> album
                </p>
                <h2 className="truncate text-xl font-semibold tracking-tight">{album.title}</h2>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {album.artists.join(", ")}
                  {album.year ? ` · ${album.year}` : ""}
                  {album.genres?.length ? ` · ${album.genres.join(", ")}` : ""}
                </p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {album.trackCount} tracks
                </p>
                <div className="mt-3.5 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      playTracks(album.tracks, 0);
                      setOpenAlbumId(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-400 px-3.5 py-1.5 text-[12.5px] font-semibold text-emerald-950 transition-colors hover:bg-emerald-300"
                  >
                    <Play size={13} /> Play all
                  </button>
                  <button
                    onClick={() => album.tracks.forEach(addToQueue)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-3.5 py-1.5 text-[12.5px] transition-colors hover:bg-white/10"
                  >
                    <ListPlus size={13} /> Queue all
                  </button>
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ul className="divide-y divide-white/5">
                {album.tracks.map((t, i) => (
                  <li key={t.id + i} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-white/4">
                    <span className="w-6 text-right font-mono text-[11px] text-muted-foreground">
                      {t.trackNumber ?? i + 1}
                    </span>
                    <button
                      onClick={() => {
                        playTracks(album.tracks, i);
                        setOpenAlbumId(null);
                      }}
                      className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-ring"
                      aria-label={`Play ${t.title}`}
                    >
                      <p className="truncate text-[13px] font-medium leading-tight">{t.title}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {t.artists.join(", ")}
                      </p>
                    </button>
                    <QualityBadge track={t} className="hidden md:inline-flex" />
                    <span className="w-10 text-right font-mono text-[11px] text-muted-foreground">
                      {formatDuration(t.durationMs)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
