#!/bin/bash
# Run periodically via crontab on this machine to catch the preview app
# going unreachable (see the /api/health route this hits: it exercises the
# same control-plane DB connection every real page load needs). Only useful
# while this Mac is on and awake — there is no server-side always-on monitor
# for this app.
set -uo pipefail

URL="https://ywiudpf9p27dxnh0mwygilyx.ewr.prisma.build/api/health"
LOG="$HOME/Library/Logs/crossfitbox-health-check.log"
TIMEOUT=20

check() {
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$URL" 2>/dev/null)
  [ "$code" = "200" ]
}

timestamp() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

if check; then
  echo "$(timestamp) OK" >> "$LOG"
  exit 0
fi

# A single miss can be a normal cold start (the endpoint itself waits on a
# database that may be waking from idle) — give it one more chance before
# treating this as a real problem.
sleep 15

if check; then
  echo "$(timestamp) OK (after retry)" >> "$LOG"
  exit 0
fi

echo "$(timestamp) FAILING: $URL did not return 200 after a retry" >> "$LOG"
osascript -e 'display notification "Preview health check failed twice in a row. Log: ~/Library/Logs/crossfitbox-health-check.log" with title "Crossfit Box preview down" sound name "Basso"' 2>/dev/null
