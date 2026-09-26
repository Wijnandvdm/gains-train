#!/usr/bin/env bash
# Start the whole local dev environment with one command:
#   Postgres (Docker) → migrations → API on :8001 (auto-reload) + frontend on :5173.
# First run also installs frontend packages and seeds the exercise library.
# Ctrl-C stops everything; if the API or the frontend exits, the other is stopped too.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

API_PORT=8001
WEB_PORT=5173

say() { printf '\033[1;32m▸ %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

for port in "$API_PORT" "$WEB_PORT"; do
  if ss -ltn "sport = :$port" | grep -q LISTEN; then
    fail "Port $port is already in use (an earlier dev server still running?). Stop it first."
  fi
done
[ -f backend/.env ] || fail "backend/.env is missing: cp backend/.env.example backend/.env and fill it in."

say "Database"
docker compose up -d --wait db

say "Migrations"
(cd backend && uv run alembic upgrade head)

if [ ! -f backend/data/free-exercise-db/VERSION ]; then
  say "First run: seeding the exercise library (~100 MB download)"
  (cd backend && uv run python -m app.cli seed-exercises)
fi
if [ ! -d frontend/node_modules ]; then
  say "First run: installing frontend packages"
  scripts/frontend-run.sh npm install
fi

# From here on, stop every process this script started when it exits for any reason.
trap 'trap - INT TERM EXIT; kill 0 2>/dev/null' INT TERM EXIT

say "API → http://localhost:$API_PORT/docs   Frontend → http://localhost:$WEB_PORT   (Ctrl-C stops both)"
(cd backend && exec uv run uvicorn app.main:app --reload --port "$API_PORT") 2>&1 |
  sed -u 's/^/[api] /' &
scripts/frontend-run.sh npx vite --port "$WEB_PORT" --strictPort 2>&1 | sed -u 's/^/[web] /' &

wait -n # returns as soon as either one stops; the trap then stops the other
