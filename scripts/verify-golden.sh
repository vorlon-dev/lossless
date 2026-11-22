#!/usr/bin/env bash
# Complete golden-path E2E in ONE call — plain-text ref extraction
set -uo pipefail
cd /home/z/my-project

pkill -f "next dev" 2>/dev/null || true
sleep 1
setsid bun run dev > /dev/null 2>&1 < /dev/null &
for i in $(seq 1 40); do curl -s -o /dev/null localhost:3000/ 2>/dev/null && break; sleep 1; done
echo "S1: server up after ${i}s"
curl -s -o /dev/null localhost:3000/api/search?q=warm

agent-browser set viewport 1440 900
agent-browser open http://localhost:3000/ > /dev/null
agent-browser wait --load networkidle
sleep 1.5
agent-browser errors --clear > /dev/null 2>&1

ref_of() {  # $1 = snapshot line regex
  agent-browser snapshot -i -c 2>/dev/null | grep -E "$1" | grep -oE "ref=[a-z0-9]+" | head -1 | cut -d= -f2
}
click_ref() {
  local r
  r=$(ref_of "$1")
  if [ -n "$r" ]; then agent-browser click @$r > /dev/null 2>&1 && echo "ok($r)"; else echo "REF-MISSING"; fi
}

echo "T1: title = $(agent-browser get title)"

echo -n "T2: goto Search = "; click_ref 'button "Search"'
sleep 1.2
FILL=$(ref_of 'textbox')
echo "T3: textbox ref=$FILL"
agent-browser fill @$FILL "neon" > /dev/null
sleep 2
echo "T4: rows = $(agent-browser get count 'ul li' 2>/dev/null | tail -1)"
echo "T5: first = $(agent-browser find first 'ul li p' text 2>&1 | grep -oE '"[^"]+"' | head -1)"
agent-browser screenshot /tmp/v-search.png > /dev/null

PLAY=$(ref_of 'button "Play Neon Meridian"')
[ -z "$PLAY" ] && PLAY=$(agent-browser snapshot -i -c 2>/dev/null | grep -E 'button "Play ' | grep -oE "ref=[a-z0-9]+" | head -1 | cut -d= -f2)
echo "T6: play ref=$PLAY"
agent-browser click @$PLAY > /dev/null
sleep 3
echo "T7: audio = $(agent-browser eval "(() => { const a = document.querySelector('audio#flux-audio'); return a ? JSON.stringify({src: decodeURIComponent(a.src).split('/').slice(-1)[0], paused: a.paused, t: Math.round(a.currentTime*10)/10}) : 'no-audio'; })()" 2>&1 | grep -oE '"src".*')"
agent-browser screenshot /tmp/v-playing.png > /dev/null

echo -n "T8: lyrics = "; click_ref 'button "Toggle lyrics"'
sleep 1.2
echo "T9: synced line = $(agent-browser eval "/City lights/.test(document.body.innerText) ? 'SYNCED-OK' : 'CHECK'" 2>&1 | tail -1)"
agent-browser screenshot /tmp/v-lyrics.png > /dev/null
echo -n "T9b: close lyrics = "; click_ref 'button "Close lyrics"'

echo -n "T10: goto API = "; click_ref 'button "API" '
sleep 1.2
echo "T11: api content = $(agent-browser eval "(() => { const t=document.body.innerText; return (t.includes('Base URL') && t.includes('/api/search') && t.includes('Generic player')) ? 'FULL' : 'PARTIAL'; })()" 2>&1 | tail -1)"
agent-browser screenshot /tmp/v-api.png > /dev/null

echo -n "T12: goto Settings = "; click_ref 'button "Settings"'
sleep 1.5
echo "T13: settings content = $(agent-browser eval "(() => { const t=document.body.innerText; return (t.includes('Antra gateway URL') && t.includes('Test & connect') && t.includes('antra-flux')) ? 'FULL' : 'PARTIAL'; })()" 2>&1 | tail -1)"
agent-browser screenshot /tmp/v-settings.png > /dev/null

echo -n "T14: goto Home = "; click_ref 'button "Home" '
sleep 1
echo -n "T15: open album = "; click_ref 'button "Open album Neon Meridian"'
sleep 1.5
echo "T16: album modal = $(agent-browser eval "(() => { const t=document.body.innerText; return (t.includes('Play all') && t.includes('Queue all') && t.includes('Chrome Sunrise')) ? 'OPEN-WITH-TRACKLIST' : 'PARTIAL'; })()" 2>&1 | tail -1)"
agent-browser screenshot /tmp/v-album.png > /dev/null
agent-browser press Escape

# mobile
agent-browser set viewport 390 844
sleep 0.8
echo "T17: mobile scrollWidth = $(agent-browser eval "document.documentElement.scrollWidth" 2>&1 | tail -1)"
agent-browser screenshot /tmp/v-mobile.png > /dev/null

echo "T18: page errors:"; agent-browser errors 2>&1 | grep -vE "✓|Done" | head -4
echo "DONE"
