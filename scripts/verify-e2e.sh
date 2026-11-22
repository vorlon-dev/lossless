#!/usr/bin/env bash
# One-shot E2E verification: dev server + API tests + agent-browser UI checks.
set -uo pipefail
cd /home/z/my-project

# ── 1. start dev server (dies with this script — sandbox lifecycle) ──────────
pkill -f "next dev" 2>/dev/null || true
rm -rf .next
setsid bun run dev > /dev/null 2>&1 < /dev/null &
for i in $(seq 1 40); do
  curl -s -o /dev/null localhost:3000/ 2>/dev/null && break
  sleep 1
done
echo "== server up (attempt $i)"

# ── 2. API tests ─────────────────────────────────────────────────────────────
echo "== /api/status:";    curl -s localhost:3000/api/status | python3 -c "import json,sys; d=json.load(sys.stdin); print('   mode:',d['mode'],'| engine:',d['engine'],'| endpoints:',len(d['endpoints']))"
echo "== /api/search:";    curl -s "localhost:3000/api/search?q=aurora&kind=song&limit=3" | python3 -c "import json,sys; d=json.load(sys.stdin); print('   tracks:',[(t['title'],t['qualityLabel']) for t in d['results']['tracks']])"
echo "== /api/album:";     curl -s localhost:3000/api/album/al-01 | python3 -c "import json,sys; d=json.load(sys.stdin); print('   ',d['title'],'/',d['trackCount'],'tracks /',d['tracks'][0]['qualityLabel'])"
echo "== /api/lyrics:";    curl -s localhost:3000/api/lyrics/demo-08 | python3 -c "import json,sys; d=json.load(sys.stdin); print('   synced:',d['hasSynced'])"
echo "== /api/catalog:";   curl -s localhost:3000/api/catalog | python3 -c "import json,sys; d=json.load(sys.stdin); print('   albums:',len(d['albums']),'tracks:',len(d['tracks']))"
echo "== CORS:";           curl -s -I "localhost:3000/api/search?q=x" | grep -ci "access-control-allow-origin" | xargs echo "   ACAO headers:"
echo "== Range:";          curl -s -H "Range: bytes=0-99" localhost:3000/demo-audio/neon-meridian.flac -o /tmp/chunk.bin -w "   status:%{http_code} size:%{size_download}\n"
echo "== OPTIONS:";        curl -s -o /dev/null -w "   status:%{http_code}\n" -X OPTIONS localhost:3000/api/search
echo "== stream redirect:"; curl -s -I localhost:3000/api/stream/demo-03 | grep -i "location" | head -1

# ── 3. browser checks ────────────────────────────────────────────────────────
agent-browser set viewport 1440 900
agent-browser open http://localhost:3000/ 
agent-browser wait --load networkidle
sleep 1
echo "== title:"; agent-browser get title
echo "== errors:"; agent-browser errors | head -5
agent-browser screenshot /tmp/flux-home.png

# go to Search
agent-browser find text "Search" click
sleep 1
agent-browser find label "Search the music catalog" fill "neon"
sleep 1.5
agent-browser screenshot /tmp/flux-search.png
echo "== search rows:"; agent-browser get count "li" --json | head -c 200; echo

# click the first play button in the track list
agent-browser find first "ul li button[aria-label^='Play']" click
sleep 2
echo "== after play, console errors:"; agent-browser errors | head -5
agent-browser screenshot /tmp/flux-playing.png

# check player bar state via eval
echo "== audio state:"; agent-browser eval "(() => { const a = document.querySelector('audio#flux-audio'); return a ? JSON.stringify({src: a.src.split('/').slice(-1)[0], paused: a.paused, time: a.currentTime.toFixed(1)}) : 'no-audio'; })()"
echo "== bar text:"; agent-browser eval "(() => { const t = document.querySelector('main')?.innerText || ''; return (document.body.innerText.match(/Neon Meridian/) ? 'track visible' : 'track NOT visible') })()"

# lyrics toggle
agent-browser find role button click --name "Toggle lyrics"
sleep 1
agent-browser screenshot /tmp/flux-lyrics.png
agent-browser find role button click --name "Close lyrics"

# API docs view
agent-browser find text "API" click
sleep 1
echo "== api docs base url:"; agent-browser eval "(() => document.body.innerText.includes('Base URL') ? 'present' : 'MISSING')"
agent-browser screenshot /tmp/flux-api.png

# settings view
agent-browser find text "Settings" click
sleep 1.5
echo "== settings status:"; agent-browser eval "(() => document.body.innerText.includes('ANTRA_GATEWAY_URL') ? 'present' : 'MISSING')"
agent-browser screenshot /tmp/flux-settings.png

# mobile viewport check
agent-browser set viewport 390 844
agent-browser find text "Home" click
sleep 1
agent-browser screenshot /tmp/flux-mobile.png
echo "== mobile overflow check:"; agent-browser eval "(() => document.documentElement.scrollWidth <= 400 ? 'no horizontal overflow' : 'OVERFLOW: '+document.documentElement.scrollWidth)"

agent-browser console | tail -8
echo "== DONE"
