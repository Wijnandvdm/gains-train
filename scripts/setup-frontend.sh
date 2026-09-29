#!/usr/bin/env bash
# Everything the app needs before it can run or be built. Used by scripts/dev.sh and
# scripts/android.sh; each step does nothing when it's already done.
#
#   1. Node 22     via nvm (frontend/.nvmrc); installed with nvm if missing.
#   2. Packages    npm install in frontend/, when package-lock.json changed or on first run.
#   3. Exercises   the exercise library in frontend/public/exercises/ (~19 MB, not committed),
#                  built by scripts/fetch-exercises.sh from pinned sources:
#                  - drawings: Workout Guide (github.com/bryllim/workout-guide), CC BY-SA 4.0
#                  - instructions + muscles: free-exercise-db (public domain), matched by hand
#                    in scripts/exercise-map.json; hand-written steps for the rest in
#                    scripts/exercise-instructions.json
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

say() { printf '\033[1;32m▸ %s\033[0m\n' "$*"; }
fail() {
  printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2
  exit 1
}

# 1. Node
nvm_sh="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
wanted="$(cat frontend/.nvmrc)"
if [ -s "$nvm_sh" ]; then
  # shellcheck disable=SC1090
  . "$nvm_sh"
  if ! nvm ls "$wanted" >/dev/null 2>&1; then
    say "Installing Node $wanted (nvm)"
    nvm install "$wanted"
  fi
fi
node_major="$(scripts/frontend-run.sh node --version 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/')"
[ "${node_major:-0}" -ge "$wanted" ] ||
  fail "Node $wanted is needed. Install nvm (github.com/nvm-sh/nvm), then run this again."

# 2. Packages
if [ ! -d frontend/node_modules ] ||
  [ frontend/package-lock.json -nt frontend/node_modules/.package-lock.json ]; then
  say "Installing frontend packages"
  scripts/frontend-run.sh npm install
fi

# 3. Exercise library
scripts/fetch-exercises.sh
