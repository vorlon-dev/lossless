"use client";
// ─── Footer (sticky bottom via mt-auto) ──────────────────────────────────────
import { AudioWaveform, ExternalLink } from "lucide-react";
import { useFlux } from "@/lib/store";

export function Footer() {
  const setView = useFlux((s) => s.setView);
  return (
    <footer className="mt-auto border-t border-white/5 bg-black/20">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <AudioWaveform size={18} className="text-emerald-300/70" aria-hidden />
          <div>
            <p className="text-[13px] font-medium">
              Antra Flux — open lossless streaming built on the Antra engine
            </p>
            <p className="text-[11.5px] text-muted-foreground">
              Stream only content you have the rights to. The platform hosts no copyrighted media.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
          <button onClick={() => setView("api")} className="hover:text-emerald-300 transition-colors">
            API
          </button>
          <button onClick={() => setView("settings")} className="hover:text-emerald-300 transition-colors">
            Settings
          </button>
          <a
            href="https://github.com/anandprtp/Antra"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-emerald-300 transition-colors"
          >
            Antra repo <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </footer>
  );
}
