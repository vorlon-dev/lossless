#!/usr/bin/env bash
# Focused interactive E2E with snapshot refs
set -uo pipefail
cd /home/z/my-project

pkill -f "next dev" 2>/dev/null || true
setsid bun run dev > /dev/null 2>&1 < /dev/null &
for i in $(seq 1 40); do curl -s -o /dev/null localhost:3000/ 2>/dev/null && break; sleep 1; done
echo "== server up"

agent-browser set viewport 1440 900
agent-browser open http://localhost:3000/ > /dev/null
agent-browser wait --load networkidle
sleep 1

echo "== header snapshot:"; agent-browser snapshot -i -c 2>&1 | head -25
