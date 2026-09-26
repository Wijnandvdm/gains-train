#!/usr/bin/env bash
# Start the dev server with one command: http://localhost:5173 (also on your network, so
# you can open it on your phone). First run also installs packages and downloads the
# exercise library (~100 MB). Ctrl-C stops it.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

WEB_PORT=5173

say() { printf '\033[1;32m▸ %s\033[0m\n' "$*"; }

if [ ! -d frontend/node_modules ]; then
  say "First run: installing frontend packages"
  scripts/frontend-run.sh npm install
fi
scripts/fetch-exercises.sh # does nothing when already downloaded

say "Frontend → http://localhost:$WEB_PORT   (Ctrl-C stops it)"
exec scripts/frontend-run.sh npx vite --port "$WEB_PORT" --strictPort
