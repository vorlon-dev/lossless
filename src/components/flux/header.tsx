"use client";
// ─── Site header: logo, nav, live status chip ────────────────────────────────
import { useEffect, useState } from "react";
import { AudioWaveform, Home, Search, Settings, Code2, ExternalLink } from "lucide-react";
import { useFlux, type View } from "@/lib/store";
import { fetchStatus } from "@/lib/api-client";
import type { StatusResponse } from "@/lib/types";

export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <span
      className="relative inline-flex items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10"
      style={{ width: size + 8, height: size + 8 }}
    >
      <AudioWaveform size={size * 0.62} className="text-emerald-300" aria-hidden />
    </span>
  );
}

function StatusChip({ status, gateway }: { status: StatusResponse | null; gateway: string | null }) {
  if (gateway) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-3 py-1 mono-label text-fuchsia-300">
        <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-fuchsia-400" />
        Gateway direct
      </span>
    );
  }
  if (!status) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 mono-label text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
        Checking…
      </span>
    );
  }
  const live = status.mode === "live" && status.gatewayOnline;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 mono-label ${
        live
          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
          : "border-cyan-400/30 bg-cyan-400/10 text-cyan-300"
      }`}
      title={
        live
          ? `Live via ${status.gatewayUrl}`
          : status.mode === "live"
            ? "Gateway unreachable — requests fail over to demo catalog"
            : "Serving built-in demo catalog — connect a gateway in Settings"
      }
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          live ? "bg-emerald-400 pulse-dot" : "bg-cyan-400"
        }`}
      />
      {live ? "Live · Antra" : "Demo catalog"}
    </span>
  );
}

const NAV: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: "home", label: "Home", icon: <Home size={15} /> },
  { id: "search", label: "Search", icon: <Search size={15} /> },
  { id: "api", label: "API", icon: <Code2 size={15} /> },
  { id: "settings", label: "Settings", icon: <Settings size={15} /> },
];

export function Header() {
  const view = useFlux((s) => s.view);
  const setView = useFlux((s) => s.setView);
  const clientGateway = useFlux((s) => s.clientGateway);
  const [status, setStatus] = useState<StatusResponse | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchStatus(ctrl.signal)
      .then(setStatus)
      .catch(() => setStatus(null));
    return () => ctrl.abort();
  }, []);

  return (
    <header className="sticky top-0 z-40 glass-strong border-b">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <button
          onClick={() => setView("home")}
          className="flex items-center gap-2.5 rounded-lg px-1 py-1 focus-visible:outline-2 focus-visible:outline-ring"
          aria-label="Antra Flux home"
        >
          <LogoMark />
          <span className="flex flex-col items-start leading-none">
            <span className="text-[15px] font-semibold tracking-wide">
              ANTRA<span className="text-emerald-300"> FLUX</span>
            </span>
            <span className="mono-label text-muted-foreground">lossless platform</span>
          </span>
        </button>

        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
                view === n.id
                  ? "bg-emerald-400/12 text-emerald-300 border border-emerald-400/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent"
              }`}
              aria-current={view === n.id ? "page" : undefined}
            >
              {n.icon}
              {n.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <StatusChip status={status} gateway={clientGateway} />
          <a
            href="https://github.com/anandprtp/Antra"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground hover:bg-white/10"
            title="Antra engine on GitHub"
          >
            Antra engine
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* mobile nav */}
      <nav
        className="flex items-center gap-1 border-t border-white/5 px-3 py-2 md:hidden"
        aria-label="Mobile"
      >
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => setView(n.id)}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] ${
              view === n.id
                ? "bg-emerald-400/12 text-emerald-300 border border-emerald-400/25"
                : "text-muted-foreground hover:text-foreground border border-transparent"
            }`}
          >
            {n.icon}
            {n.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
