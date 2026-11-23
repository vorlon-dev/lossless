"use client";
// ─── API docs view: endpoint reference + code samples for music-app devs ─────
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Check, Terminal, Music4, ShieldCheck, Globe } from "lucide-react";
import { ENDPOINT_DOCS } from "@/lib/api-core";
import { useFlux } from "@/lib/store";

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-black/45">
      <div className="flex items-center justify-between border-b border-white/8 px-3.5 py-1.5">
        <span className="mono-label text-muted-foreground">{lang}</span>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(code).then(
              () => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              },
              () => undefined
            );
          }}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
          aria-label="Copy code"
        >
          {copied ? <Check size={13} className="text-emerald-300" /> : <Copy size={13} />}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3 font-mono text-[12px] leading-relaxed text-emerald-200/90">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="glass min-w-0 rounded-2xl p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
        <span className="inline-flex rounded-lg border border-white/10 bg-white/5 p-2 [&_svg]:text-emerald-300">
          {icon}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function ApiDocsView() {
  const clientGateway = useFlux((s) => s.clientGateway);
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    const id = requestAnimationFrame(() => setOrigin(window.location.origin));
    return () => cancelAnimationFrame(id);
  }, []);
  const base = clientGateway ? clientGateway.replace(/\/+$/, "") : origin || "https://your-site.pages.dev";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-7">
        <p className="mono-label mb-2 text-emerald-300">developer interface</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Streaming API — plug any music app in
        </h1>
        <p className="mt-2.5 max-w-3xl text-[13.5px] leading-relaxed text-muted-foreground">
          Every endpoint below is CORS-open and backed by the live YouTube Music metadata
          backend, so desktop players, mobile apps, web clients and streamers (Symfonium,
          Feishin, mpv, custom apps…) can consume real catalog data directly. Playback is
          delegated to the stream resolver you configure. Point them at the base URL and use
          the endpoints like any normal REST backend.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {/* base URL */}
        <Section title="Base URL" icon={<Globe size={16} />}>
          <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/8 px-4 py-3 font-mono text-[13px] text-emerald-200">
            {base}
          </div>
          {clientGateway ? (
            <p className="mt-2.5 text-[12px] text-muted-foreground">
              Showing your direct-backend URL (set in Settings). Without it, the browser origin of
              this deployment serves the same endpoints through the Worker / Pages Functions.
            </p>
          ) : (
            <p className="mt-2.5 text-[12px] text-muted-foreground">
              This is the origin of your current deployment. On Cloudflare these endpoints run at
              the edge on the free plan (100k requests/day included).
            </p>
          )}
        </Section>

        {/* endpoint table */}
        <Section title="Endpoints" icon={<Terminal size={16} />}>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-white/10 bg-white/4">
                  <th className="px-4 py-2.5 font-semibold">Method</th>
                  <th className="px-4 py-2.5 font-semibold">Path</th>
                  <th className="hidden px-4 py-2.5 font-semibold md:table-cell">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {ENDPOINT_DOCS.map((e) => (
                  <tr key={e.path} className="hover:bg-white/3">
                    <td className="px-4 py-2.5 align-top">
                      <span className="rounded-md border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 font-mono text-[10.5px] text-emerald-300">
                        {e.method}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 align-top font-mono text-[12px] text-cyan-200">
                      {e.path}
                    </td>
                    <td className="px-4 py-2.5 align-top text-muted-foreground md:table-cell">
                      {e.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[12px] text-muted-foreground">
            Search parameters: <code className="font-mono text-emerald-200/80">q</code> (query),{" "}
            <code className="font-mono text-emerald-200/80">kind</code> = song | album | artist | all,{" "}
            <code className="font-mono text-emerald-200/80">limit</code> (1–50). Track ids are YouTube
            video ids (e.g. <code className="font-mono text-emerald-200/80">4NRXx6U8ABQ</code>); album ids
            are <code className="font-mono text-emerald-200/80">MPREb_…</code> browse ids.
          </p>
        </Section>

        {/* code samples */}
        <Section title="Examples for your music app" icon={<Music4 size={16} />}>
          <Tabs defaultValue="curl" className="w-full">
            <TabsList className="bg-white/5">
              <TabsTrigger value="curl" className="text-[12px]">curl</TabsTrigger>
              <TabsTrigger value="python" className="text-[12px]">Python</TabsTrigger>
              <TabsTrigger value="js" className="text-[12px]">JavaScript</TabsTrigger>
              <TabsTrigger value="app" className="text-[12px]">Generic player</TabsTrigger>
            </TabsList>
            <TabsContent value="curl" className="mt-3">
              <CodeBlock
                lang="shell"
                code={`# 1) search (songs)
curl "${base}/api/search?q=blinding%20lights&kind=song&limit=5"

# 2) track metadata + queue context + lyrics
curl "${base}/api/track/4NRXx6U8ABQ"

# 3) audio playback (302-redirects to the configured stream resolver)
curl -L "${base}/api/stream/4NRXx6U8ABQ" -o track.audio

# 4) trending / new releases / charts in one call
curl "${base}/api/catalog"

# 5) service status
curl "${base}/api/status"`}
              />
            </TabsContent>
            <TabsContent value="python" className="mt-3">
              <CodeBlock
                lang="python"
                code={`import requests, webbrowser

BASE = "${base}"

# search
r = requests.get(f"{BASE}/api/search", params={"q": "blinding lights", "kind": "song", "limit": 5})
tracks = r.json()["results"]["tracks"]
track = tracks[0]
print(track["title"], "—", track["artists"][0])

# lyrics + playback inside your app
lyrics = requests.get(f"{BASE}/api/lyrics/{track['id']}").json()
url = BASE + track["streamUrl"]          # e.g. .../api/stream/4NRXx6U8ABQ
print("stream URL:", url)`}
              />
            </TabsContent>
            <TabsContent value="js" className="mt-3">
              <CodeBlock
                lang="javascript"
                code={`const BASE = "${base}";

// search
const res = await fetch(\`\${BASE}/api/search?q=blinding lights&kind=song&limit=5\`);
const { results } = await res.json();
const track = results.tracks[0];

// metadata + audio in an <audio> element
const audio = new Audio(BASE + track.streamUrl);
audio.crossOrigin = "anonymous";       // analyser / visualizer support
await audio.play();`}
              />
            </TabsContent>
            <TabsContent value="app" className="mt-3">
              <div className="space-y-3 text-[12.5px] leading-relaxed text-muted-foreground">
                <p>
                  Most players accept a plain HTTP audio URL. Use{" "}
                  <code className="font-mono text-emerald-200/80">/api/stream/&lt;id&gt;</code> as the
                  track URL and <code className="font-mono text-emerald-200/80">/api/search</code> as
                  the search backend:
                </p>
                <ul className="list-disc space-y-1.5 pl-5">
                  <li>
                    <span className="text-foreground">mpv:</span>{" "}
                    <code className="font-mono text-emerald-200/80">mpv {base}/api/stream/4NRXx6U8ABQ</code>
                  </li>
                  <li>
                    <span className="text-foreground">ffplay:</span>{" "}
                    <code className="font-mono text-emerald-200/80">ffplay {base}/api/stream/4NRXx6U8ABQ</code>
                  </li>
                  <li>
                    <span className="text-foreground">M3U playlist:</span> one line per stream URL,
                    saved as <code className="font-mono text-emerald-200/80">.m3u</code> — works in
                    Symfonium, VLC, Feishin and most Android/iOS players.
                  </li>
                  <li>
                    <span className="text-foreground">Custom apps:</span> the responses are plain
                    JSON; <code className="font-mono text-emerald-200/80">qualityLabel</code>,{" "}
                    <code className="font-mono text-emerald-200/80">format.codec</code> and{" "}
                    <code className="font-mono text-emerald-200/80">sourceUrl</code> let you render
                    badges and deep-links natively.
                  </li>
                </ul>
              </div>
            </TabsContent>
          </Tabs>
        </Section>

        {/* auth + notes */}
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <Section title="Authentication & CORS" icon={<ShieldCheck size={16} />}>
            <ul className="list-disc space-y-2 pl-5 text-[12.5px] leading-relaxed text-muted-foreground">
              <li>
                Endpoints are <span className="text-foreground">open by default</span>. If you set
                the <code className="font-mono text-emerald-200/80">ANTRA_API_KEY</code> env var on
                your deployment, clients must send{" "}
                <code className="font-mono text-emerald-200/80">x-api-key: &lt;key&gt;</code> (or{" "}
                <code className="font-mono text-emerald-200/80">?key=</code>).
              </li>
              <li>
                Every response carries{" "}
                <code className="font-mono text-emerald-200/80">Access-Control-Allow-Origin: *</code>{" "}
                — browser-based players and any app can call the API without a proxy.
              </li>
              <li>Responses are cached at the edge (search TTL ~2 min, catalog ~5 min) and safe to call per keystroke.</li>
            </ul>
          </Section>
          <Section title="Where the audio comes from" icon={<Terminal size={16} />}>
            <ul className="list-disc space-y-2 pl-5 text-[12.5px] leading-relaxed text-muted-foreground">
              <li>
                <span className="text-foreground">Metadata:</span> served live from your YouTube
                Music backend — set <code className="font-mono text-emerald-200/80">ANTRA_GATEWAY_URL</code>{" "}
                (a sane default is built in) or connect per-browser in Settings.
              </li>
              <li>
                <span className="text-foreground">Playback:</span> this API is metadata-only until
                you set <code className="font-mono text-emerald-200/80">ANTRA_STREAM_TEMPLATE</code>{" "}
                (e.g. <code className="font-mono">https://your-resolver.example/stream/{"{id}"}</code>).{" "}
                /api/stream/&lt;id&gt; then 302-redirects to that resolver with the track id filled in.
              </li>
              <li>
                The audio codec and quality are whatever your resolver serves — the metadata layer
                stays the same either way.
              </li>
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}
