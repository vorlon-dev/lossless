"use client";
// ─── Player bar: global audio element, transport, seek, volume, queue, lyrics ─
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  ListMusic,
  Mic2,
  X,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useFlux, setAudioEl, resolveStreamSrc } from "@/lib/store";
import { Visualizer } from "./visualizer";
import { QualityBadge, formatSeconds } from "./quality-badge";
import { LyricsPanel } from "./lyrics-panel";

export function PlayerBar() {
  const queue = useFlux((s) => s.queue);
  const currentIndex = useFlux((s) => s.currentIndex);
  const isPlaying = useFlux((s) => s.isPlaying);
  const volume = useFlux((s) => s.volume);
  const muted = useFlux((s) => s.muted);
  const shuffle = useFlux((s) => s.shuffle);
  const repeat = useFlux((s) => s.repeat);
  const currentTime = useFlux((s) => s.currentTime);
  const duration = useFlux((s) => s.duration);
  const seekRequest = useFlux((s) => s.seekRequest);
  const clearSeek = useFlux((s) => s.clearSeek);
  const togglePlay = useFlux((s) => s.togglePlay);
  const next = useFlux((s) => s.next);
  const prev = useFlux((s) => s.prev);
  const requestSeek = useFlux((s) => s.requestSeek);
  const setVolume = useFlux((s) => s.setVolume);
  const toggleMute = useFlux((s) => s.toggleMute);
  const toggleShuffle = useFlux((s) => s.toggleShuffle);
  const cycleRepeat = useFlux((s) => s.cycleRepeat);
  const reportTime = useFlux((s) => s.reportTime);
  const playTracks = useFlux((s) => s.playTracks);
  const removeFromQueue = useFlux((s) => s.removeFromQueue);
  const clearQueue = useFlux((s) => s.clearQueue);
  const clientGateway = useFlux((s) => s.clientGateway);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [showLyrics, setShowLyrics] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [scrub, setScrub] = useState<number | null>(null);

  const track = queue[currentIndex] ?? null;

  // register the declarative audio element with the store
  useEffect(() => {
    setAudioEl(audioRef.current);
    return () => setAudioEl(null);
  }, []);

  // wire element events
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => reportTime(a.currentTime, a.duration || 0);
    const onEnded = () => {
      const st = useFlux.getState();
      if (st.repeat === "one" && st.queue.length) {
        a.currentTime = 0;
        a.play().catch(() => undefined);
      } else {
        st.next();
      }
    };
    const onPlay = () => useFlux.setState({ isPlaying: true });
    const onPause = () => useFlux.setState({ isPlaying: false });
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("durationchange", onTime);
    a.addEventListener("ended", onEnded);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("durationchange", onTime);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
    };
  }, [reportTime]);

  // apply seek requests
  useEffect(() => {
    const a = audioRef.current;
    if (a && seekRequest != null) {
      a.currentTime = seekRequest;
      clearSeek();
    }
  }, [seekRequest, clearSeek]);

  // crossOrigin: anonymous for same-origin (analyser-safe), unset for cross-origin
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const src = a.src;
    if (src) {
      try {
        const same = new URL(src, window.location.href).origin === window.location.origin;
        a.crossOrigin = same ? "anonymous" : null;
      } catch {
        /* keep default */
      }
    }
  }, [track?.id, clientGateway]);

  const onScrub = useCallback(
    (vals: number[]) => setScrub(vals[0] ?? 0),
    []
  );
  const onScrubCommit = useCallback(
    (vals: number[]) => {
      requestSeek(vals[0] ?? 0);
      setScrub(null);
    },
    [requestSeek]
  );

  const shown = scrub ?? Math.min(currentTime, duration || 0);
  const dispDuration = duration || (track ? track.durationMs / 1000 : 0);
  const hasQueue = queue.length > 0;

  return (
    <>
      {showLyrics && <LyricsPanel onClose={() => setShowLyrics(false)} />}

      <div className="sticky bottom-0 z-40 border-t border-white/10 glass-strong">
        {/* hidden audio element — the whole app streams through this */}
        <audio id="flux-audio" ref={audioRef} preload="auto" className="hidden" />

        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-3 py-2.5 sm:px-6">
          {/* seek row */}
          <div className="flex items-center gap-3">
            <span className="w-10 text-right font-mono text-[10.5px] text-muted-foreground">
              {formatSeconds(shown)}
            </span>
            <Slider
              value={[shown]}
              min={0}
              max={Math.max(1, dispDuration)}
              step={0.5}
              onValueChange={onScrub}
              onValueCommit={onScrubCommit}
              disabled={!hasQueue}
              aria-label="Seek"
              className="[&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:border-emerald-300 [&_[role=slider]]:bg-emerald-300 [&>.relative>div:first-child]:h-1 [&>.relative>div:first-child>div]:bg-gradient-to-r [&>.relative>div:first-child>div]:from-emerald-400 [&>.relative>div:first-child>div]:to-cyan-400"
            />
            <span className="w-10 font-mono text-[10.5px] text-muted-foreground">
              {formatSeconds(dispDuration)}
            </span>
          </div>

          {/* main row */}
          <div className="flex items-center gap-3">
            {/* artwork + meta */}
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:w-64 sm:flex-none lg:w-80">
              {track?.artworkUrl ? (
                 
                <img
                  src={track.artworkUrl}
                  alt=""
                  className="h-11 w-11 shrink-0 rounded-lg border border-white/10 object-cover"
                />
              ) : (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                  <Play size={14} className="text-muted-foreground" />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium leading-tight">
                  {track ? track.title : "Nothing playing"}
                </p>
                <p className="truncate text-[11.5px] text-muted-foreground">
                  {track ? track.artists.join(", ") : "Search and press play"}
                </p>
              </div>
              {track && <QualityBadge track={track} className="hidden md:inline-flex" />}
            </div>

            {/* transport */}
            <div className="flex items-center gap-1 sm:gap-1.5">
              <button
                onClick={toggleShuffle}
                className={`hidden rounded-lg p-2 transition-colors sm:block ${
                  shuffle ? "text-emerald-300 bg-emerald-400/10" : "text-muted-foreground hover:text-foreground"
                }`}
                aria-label="Shuffle"
                aria-pressed={shuffle}
              >
                <Shuffle size={15} />
              </button>
              <button
                onClick={prev}
                disabled={!hasQueue}
                className="rounded-lg p-2 text-foreground transition-colors hover:bg-white/10 disabled:opacity-40"
                aria-label="Previous track"
              >
                <SkipBack size={17} />
              </button>
              <button
                onClick={togglePlay}
                disabled={!hasQueue}
                className="mx-1 inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400 text-emerald-950 shadow-[0_0_20px_oklch(0.8_0.155_165/0.4)] transition-all hover:bg-emerald-300 disabled:opacity-40 disabled:shadow-none"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause size={17} /> : <Play size={17} className="ml-0.5" />}
              </button>
              <button
                onClick={next}
                disabled={!hasQueue}
                className="rounded-lg p-2 text-foreground transition-colors hover:bg-white/10 disabled:opacity-40"
                aria-label="Next track"
              >
                <SkipForward size={17} />
              </button>
              <button
                onClick={cycleRepeat}
                className={`hidden rounded-lg p-2 transition-colors sm:block ${
                  repeat !== "off" ? "text-emerald-300 bg-emerald-400/10" : "text-muted-foreground hover:text-foreground"
                }`}
                aria-label={`Repeat: ${repeat}`}
              >
                {repeat === "one" ? <Repeat1 size={15} /> : <Repeat size={15} />}
              </button>
            </div>

            {/* right controls */}
            <div className="flex flex-1 items-center justify-end gap-2">
              <Visualizer
                playing={isPlaying}
                barCount={22}
                className="hidden h-7 w-28 md:block lg:w-36"
              />
              <button
                onClick={() => setShowLyrics((v) => !v)}
                disabled={!track}
                className={`rounded-lg p-2 transition-colors ${
                  showLyrics ? "text-emerald-300 bg-emerald-400/10" : "text-muted-foreground hover:text-foreground"
                } disabled:opacity-40`}
                aria-label="Toggle lyrics"
              >
                <Mic2 size={15} />
              </button>
              <div className="hidden items-center gap-2 lg:flex">
                <button
                  onClick={toggleMute}
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={muted ? "Unmute" : "Mute"}
                >
                  {muted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
                </button>
                <Slider
                  value={[muted ? 0 : volume]}
                  min={0}
                  max={1}
                  step={0.02}
                  onValueChange={(v) => setVolume(v[0] ?? 0.85)}
                  aria-label="Volume"
                  className="w-20 [&_[role=slider]]:h-2.5 [&_[role=slider]]:w-2.5 [&_[role=slider]]:border-emerald-300 [&_[role=slider]]:bg-emerald-300 [&>.relative>div:first-child]:h-1 [&>.relative>div:first-child>div]:bg-emerald-300"
                />
              </div>

              <Sheet open={queueOpen} onOpenChange={setQueueOpen}>
                <SheetTrigger asChild>
                  <button
                    className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Queue"
                  >
                    <ListMusic size={15} />
                    {hasQueue && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-400 px-1 font-mono text-[9px] font-bold text-emerald-950">
                        {queue.length}
                      </span>
                    )}
                  </button>
                </SheetTrigger>
                <SheetContent side="right" className="glass-strong w-full border-white/10 sm:max-w-sm">
                  <SheetHeader className="border-b border-white/8 px-4 py-3">
                    <SheetTitle className="text-[14px]">
                      Queue <span className="text-muted-foreground">({queue.length})</span>
                    </SheetTitle>
                    {hasQueue && (
                      <button
                        onClick={clearQueue}
                        className="mono-label absolute right-4 top-3.5 flex items-center gap-1 text-muted-foreground hover:text-red-300"
                      >
                        <X size={12} /> clear
                      </button>
                    )}
                  </SheetHeader>
                  <div className="max-h-full overflow-y-auto px-2 py-2">
                    {!hasQueue && (
                      <p className="px-3 py-8 text-center text-[12.5px] text-muted-foreground">
                        Queue is empty — play something from Search or an album page.
                      </p>
                    )}
                    {queue.map((t, i) => (
                      <div
                        key={`${t.id}-${i}`}
                        className={`group flex items-center gap-2.5 rounded-xl px-2 py-2 ${
                          i === currentIndex ? "bg-emerald-400/10" : "hover:bg-white/5"
                        }`}
                      >
                        <button
                          onClick={() => playTracks(queue, i)}
                          className="flex min-w-0 flex-1 items-center gap-2.5 text-left focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          {t.artworkUrl ? (
                             
                            <img src={t.artworkUrl} alt="" className="h-9 w-9 rounded-md object-cover" />
                          ) : (
                            <span className="h-9 w-9 rounded-md bg-white/8" />
                          )}
                          <span className="min-w-0">
                            <span
                              className={`block truncate text-[12.5px] font-medium ${
                                i === currentIndex ? "text-emerald-300" : ""
                              }`}
                            >
                              {t.title}
                            </span>
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {t.artists.join(", ")}
                            </span>
                          </span>
                        </button>
                        {i === currentIndex && (
                          <span className="flex items-end gap-[2px] pr-1" aria-hidden>
                            {[0, 1, 2].map((b) => (
                              <span
                                key={b}
                                className="eq-bar w-[3px] rounded-sm bg-emerald-300"
                                style={{
                                  height: 10 + b * 3,
                                  animationDelay: `${b * 0.18}s`,
                                }}
                              />
                            ))}
                          </span>
                        )}
                        <button
                          onClick={() => removeFromQueue(i)}
                          className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:text-red-300 group-hover:opacity-100"
                          aria-label={`Remove ${t.title} from queue`}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
