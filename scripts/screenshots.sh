#!/usr/bin/env bash
# Take the Play Store screenshots with one command:   scripts/screenshots.sh
#   → ~/repos/gains-train-screenshots/<version>/light/*.png and …/dark/*.png
#     (or $SCREENSHOT_DIR/<version>/: they're not kept in the repo)
#
# Runs the app (the Vite dev server) in a headless Chrome sized like a phone (360 × 640 at 3×,
# so 1080 × 1920: 9:16, big enough for Google to promote the app). It fills the app with demo
# data first: three months of a push/pull/legs routine up to today, with a week in the depot
# and a backup made. Then it photographs each screen, once light and once dark. What the
# screens are, and the demo data: scripts/screenshots.mjs. Re-run it for each new version.
#
# Needs a Chrome or Chromium. It uses $CHROME, else Playwright's headless shell (in
# ~/.cache/ms-playwright), else chromium / google-chrome on the PATH. None? Install one with
#   scripts/frontend-run.sh npx playwright install chromium-headless-shell
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

say() { printf '\033[1;32m▸ %s\033[0m\n' "$*"; }
fail() {
  printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2
  exit 1
}

PORT="${PORT:-5199}"           # the dev server
CDP_PORT="${CDP_PORT:-9333}"   # Chrome's remote control

chrome="${CHROME:-}"
if [ -z "$chrome" ]; then
  chrome="$(ls -d "$HOME"/.cache/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell 2>/dev/null | sort -V | tail -1 || true)"
fi
for candidate in chromium chromium-browser google-chrome; do
  [ -n "$chrome" ] && break
  chrome="$(command -v "$candidate" || true)"
done
[ -n "$chrome" ] || fail "No Chrome found: see the top of scripts/screenshots.sh"

scripts/setup-frontend.sh >/dev/null
version="$(sed -n 's/^ *"version": "\(.*\)",$/\1/p' frontend/package.json | head -1)"
out="${SCREENSHOT_DIR:-$HOME/repos/gains-train-screenshots}/$version"

# Everything started here stops again on exit, also after an error.
profile="$(mktemp -d)"
pids=()
cleanup() {
  # Each runs in its own process group (setsid), so this stops its children too (npx → vite).
  for pid in "${pids[@]}"; do kill -- "-$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
  rm -rf "$profile"
}
trap cleanup EXIT

say "Starting the app on port $PORT"
setsid scripts/frontend-run.sh npx vite --port "$PORT" --strictPort >"$profile/vite.log" 2>&1 &
pids+=($!)
for _ in $(seq 60); do
  curl -sf "http://localhost:$PORT/" >/dev/null && break
  sleep 0.5
done
curl -sf "http://localhost:$PORT/" >/dev/null || fail "The app didn't start: $(cat "$profile/vite.log")"

say "Starting Chrome"
setsid "$chrome" --headless --no-sandbox --remote-debugging-port="$CDP_PORT" \
  --user-data-dir="$profile/chrome" about:blank >/dev/null 2>&1 &
pids+=($!)
for _ in $(seq 40); do
  curl -sf "http://127.0.0.1:$CDP_PORT/json/version" >/dev/null && break
  sleep 0.25
done

for theme in light dark; do
  say "Screenshots, $theme"
  mkdir -p "$out/$theme"
  scripts/frontend-run.sh node "$root/scripts/screenshots.mjs" \
    "http://localhost:$PORT" "$CDP_PORT" "$theme" "$out/$theme"
done
say "Done: $out"
