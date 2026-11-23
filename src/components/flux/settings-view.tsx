"use client";
// ─── Settings view: per-browser gateway connection + status inspector ────────
import { useCallback, useEffect, useState } from "react";
import { Loader2, Plug, PlugZap, Unplug, Terminal, RotateCcw } from "lucide-react";
import { useFlux } from "@/lib/store";
import { fetchStatus, normalizeGateway } from "@/lib/api-client";
import type { StatusResponse } from "@/lib/types";

const LS_KEY = "flux.gatewayUrl";

export function SettingsView() {
  const clientGateway = useFlux((s) => s.clientGateway);
  const setClientGateway = useFlux((s) => s.setClientGateway);
  const [input, setInput] = useState(clientGateway ?? "");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<
    { ok: boolean; message: string; info?: Record<string, unknown> } | null
  >(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);

  useEffect(() => {
    // hydrate from localStorage
    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      setClientGateway(saved);
      setInput(saved);
    }
    fetchStatus().then(setStatus).catch(() => undefined);
  }, [setClientGateway]);

  const save = useCallback(() => {
    const cleaned = input.trim();
    if (!cleaned) {
      setClientGateway(null);
      localStorage.removeItem(LS_KEY);
      setTestResult({ ok: true, message: "Cleared — using the site's own /api endpoints again." });
      return;
    }
    const normalized = normalizeGateway(cleaned);
    if (!/^https?:\/\//.test(normalized)) {
      setTestResult({ ok: false, message: "URL must start with http:// or https://" });
      return;
    }
    setClientGateway(normalized);
    localStorage.setItem(LS_KEY, normalized);
    setInput(normalized);
  }, [input, setClientGateway]);

  const test = useCallback(async () => {
    const target = input.trim() ? normalizeGateway(input) : null;
    if (!target) {
      setTestResult({ ok: true, message: "No backend URL set — using the site's default YTM metadata backend." });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const r = await fetch(`${target}/health`, { signal: AbortSignal.timeout(8000) });
      const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (r.ok) {
        setTestResult({
          ok: true,
          message: `Gateway online${body?.engine ? ` — engine: ${String(body.engine)}` : ""}`,
          info: body,
        });
        setClientGateway(target);
        localStorage.setItem(LS_KEY, target);
        setInput(target);
      } else {
        setTestResult({ ok: false, message: `Gateway responded with HTTP ${r.status}` });
      }
    } catch (e: unknown) {
      setTestResult({
        ok: false,
        message:
          e instanceof Error && e.name === "TimeoutError"
            ? "Timed out after 8s — is the host reachable and CORS enabled?"
            : `Connection failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setTesting(false);
    }
  }, [input, setClientGateway]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-7">
        <p className="mono-label mb-2 text-emerald-300">configuration</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-2.5 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
          This site talks to a YouTube Music metadata backend through its own /api endpoints.
          Connect a different backend to browse its catalog instead — the connection is stored in
          this browser only.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <section className="glass min-w-0 rounded-2xl p-5 sm:p-6">
          <h2 className="mb-1 flex items-center gap-2.5 text-[15px] font-semibold">
            <span className="inline-flex rounded-lg border border-white/10 bg-white/5 p-2">
              <Plug size={16} className="text-emerald-300" />
            </span>
            Metadata backend URL
          </h2>
          <p className="mb-4 text-[12px] leading-relaxed text-muted-foreground">
            e.g. <code className="font-mono text-emerald-200/80">https://ytm-backend.vorlon-revora.workers.dev</code>.{" "}
            The backend must expose <code className="font-mono">/health</code>,{" "}
            <code className="font-mono">/search</code>, <code className="font-mono">/album</code> etc. with CORS enabled.
          </p>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && test()}
              placeholder="https://your-ytm-backend.example"
              className="h-11 flex-1 rounded-xl border border-white/12 bg-white/5 px-4 font-mono text-[13px] placeholder:text-muted-foreground/60 focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/25"
              aria-label="Backend base URL"
            />
            <div className="flex gap-2">
              <button
                onClick={test}
                disabled={testing}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-400 px-4 text-[13px] font-semibold text-emerald-950 transition-colors hover:bg-emerald-300 disabled:opacity-60"
              >
                {testing ? <Loader2 size={15} className="animate-spin" /> : <PlugZap size={15} />}
                Test & connect
              </button>
              <button
                onClick={() => {
                  setInput("");
                  setClientGateway(null);
                  localStorage.removeItem(LS_KEY);
                  setTestResult({ ok: true, message: "Disconnected — back to the site's own API." });
                }}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/12 bg-white/5 px-4 text-[13px] transition-colors hover:bg-white/10"
              >
                <Unplug size={15} /> Disconnect
              </button>
            </div>
          </div>

          {testResult && (
            <div
              className={`mt-4 rounded-xl border px-4 py-3 text-[12.5px] ${
                testResult.ok
                  ? "border-emerald-400/25 bg-emerald-400/8 text-emerald-200"
                  : "border-destructive/30 bg-destructive/10 text-red-300"
              }`}
              role="status"
            >
              {testResult.ok ? "Connected. " : ""}
              {testResult.message}
              {testResult.info && (
                <pre className="mt-2 overflow-x-auto rounded-lg border border-white/8 bg-black/40 p-3 font-mono text-[11px] text-emerald-200/80">
                  {JSON.stringify(testResult.info, null, 2)}
                </pre>
              )}
            </div>
          )}
        </section>

        <section className="glass min-w-0 rounded-2xl p-5 sm:p-6">
          <h2 className="mb-1 flex items-center gap-2.5 text-[15px] font-semibold">
            <span className="inline-flex rounded-lg border border-white/10 bg-white/5 p-2">
              <Terminal size={16} className="text-cyan-300" />
            </span>
            This deployment&rsquo;s /api/status
          </h2>
          <p className="mb-3 text-[12px] text-muted-foreground">
            Server-side configuration of this site (env vars on Cloudflare): ANTRA_GATEWAY_URL,
            optional ANTRA_API_KEY and optional ANTRA_STREAM_TEMPLATE.
          </p>
          <div className="relative">
            <pre className="max-w-full overflow-x-auto rounded-xl border border-white/10 bg-black/45 p-4 font-mono text-[11.5px] leading-relaxed text-emerald-200/85">
              {status ? JSON.stringify(status, null, 2) : "loading…"}
            </pre>
            <button
              onClick={() => fetchStatus().then(setStatus).catch(() => undefined)}
              className="absolute right-3 top-3 rounded-lg border border-white/10 bg-black/40 p-2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Refresh status"
              title="Refresh"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </section>

        <section className="min-w-0 rounded-2xl border border-white/8 bg-white/3 p-5 text-[12px] leading-relaxed text-muted-foreground sm:p-6">
          <h2 className="mb-2 text-[13.5px] font-semibold text-foreground">
            Running your own backend
          </h2>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              Deploy your YTM metadata worker (search / albums / artists / lyrics endpoints with
              CORS) — any Cloudflare Workers project with a <code className="font-mono">/health</code> route works.
            </li>
            <li>
              Paste its URL above, or make it the site-wide default by setting{" "}
              <code className="font-mono text-emerald-200/80">ANTRA_GATEWAY_URL</code> in your
              Cloudflare Worker environment variables (wrangler secret or dashboard).
            </li>
            <li>
              To enable playback, set{" "}
              <code className="font-mono text-emerald-200/80">ANTRA_STREAM_TEMPLATE</code> to a resolver
              URL containing <code className="font-mono">{"{id}"}</code> — /api/stream/&lt;id&gt; will redirect
              there for every track.
            </li>
          </ol>
        </section>
      </div>
    </div>
  );
}
