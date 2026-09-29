#!/usr/bin/env bash
# Develop gains-train with one command:   scripts/dev.sh   → http://localhost:5173
#
# It checks and sets up everything first, then starts the dev server (also reachable on your
# network, so you can open it on your phone). Ctrl-C stops it. Each step does nothing when
# it's already done, so it's quick after the first run.
#
#   1-3.           Node 22, the packages and the exercise library: see scripts/setup-frontend.sh
#   4. Git hooks   pre-commit (pre-commit.com), if you have it. On every commit: formatting,
#                  lint, type check, secret scan. On every push: the tests and knip (unused
#                  files, exports, packages). Run them all by hand: pre-commit run --all-files
#   5. Dev server  Vite, reloads as you edit. No offline caching in this mode.
#
# Handy commands (from frontend/, or prefix with scripts/frontend-run.sh from the repo root):
#   npm test                       the test suite (npm run test:watch keeps it running)
#   npm run lint / npx knip        lint / unused code
#   scripts/android.sh (repo root) the Android app: the product, see that script
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

WEB_PORT=5173

say() { printf '\033[1;32m▸ %s\033[0m\n' "$*"; }

# 1-3. Node, packages, exercise library
scripts/setup-frontend.sh

# 4. Git hooks
if [ ! -f .git/hooks/pre-commit ] || [ ! -f .git/hooks/pre-push ]; then
  if command -v pre-commit >/dev/null; then
    say "Installing the git hooks (pre-commit)"
    pre-commit install --install-hooks
  else
    say "Tip: install pre-commit (pipx install pre-commit) to check each commit automatically"
  fi
fi

# 5. Dev server
say "gains-train → http://localhost:$WEB_PORT   (Ctrl-C stops it)"
exec scripts/frontend-run.sh npx vite --port "$WEB_PORT" --strictPort
