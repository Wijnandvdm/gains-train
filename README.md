# gains-train

Mobile-first workout tracker: exercise library, live workout logging, progress charts and PRs.

- **backend/**: FastAPI + SQLAlchemy 2 (async) + Postgres, managed with [uv](https://docs.astral.sh/uv/)
- **frontend/**: React + TypeScript (Vite), Tailwind, installable as a PWA

## Prerequisites

- Docker with the Compose plugin
- uv (installs Python 3.12 for the project automatically)
- Node 22 (`nvm install 22`)

## Run locally

```bash
# 1. Database
docker compose up -d db

# 2. API → http://localhost:8001 (Swagger docs at /docs)
cd backend
cp .env.example .env                            # first time only
uv run alembic upgrade head                     # apply database migrations
uv run python -m app.cli seed-exercises         # first time only: exercise library (~100 MB)
uv run uvicorn app.main:app --reload --port 8001

# 3. Frontend → http://localhost:5173 (proxies /api to the API)
cd frontend
npm install                 # first time only
npm run dev
```

## Installable app (PWA) and offline use

`npm run dev` runs without the service worker. To try the real, installable app:

```bash
cd frontend
npm run build && npm run preview   # → http://localhost:4173 (proxies /api to the API)
```

- The app shell is cached up front, exercise images when first seen, and your data
  (network first, cached copy as offline fallback; cleared on sign-out).
- Sets logged offline are queued and synced when the connection returns.
- A new deploy shows a "New version available · Reload" banner instead of reloading mid-workout.
- Installing on a phone needs HTTPS (e.g. Tailscale or a Cloudflare Tunnel in front of this VM).
- App icons are generated from `frontend/public/favicon.svg`: `npx @vite-pwa/assets-generator@1`.

## Importing the legacy Google Sheets log

Export the sheet's **Log** tab as CSV, then (from `backend/`):

```bash
uv run python -m app.cli import-legacy --email you@example.com --dry-run "gainz - Log.csv"
uv run python -m app.cli import-legacy --email you@example.com "gainz - Log.csv"
```

Re-running is safe: workouts are updated in place, not duplicated. Exercise names are mapped to
the library via [`legacy_exercise_map.toml`](backend/app/importers/legacy_exercise_map.toml).
The exercise library comes from [free-exercise-db](https://github.com/yuhonas/free-exercise-db)
(public domain).

## API types

The frontend's API types (`frontend/src/api/schema.d.ts`) are generated from the backend's
OpenAPI spec. After changing backend routes or schemas, run `scripts/gen-api.sh`; pre-commit
also regenerates them and fails the commit if they changed, so stage the updated file.

## Checks

[pre-commit](https://pre-commit.com) runs formatting, linting, type checks and secret scanning on
every commit, and the test suite on every push:

```bash
pre-commit install          # first time only; installs commit + push hooks
pre-commit run --all-files  # run everything manually
```

Or run the tools directly:

```bash
cd backend && uv run pytest && uv run ruff check . && uv run mypy app tests
cd frontend && npm test && npm run build && npm run lint
```

## TODOS:
1. ugly kilo numbers 7.987 something
2. ability to schedule your own days, so to create a day 1, day 2, day 3 with whatever exercises you want or start with the "standard" one I got from my stuff here: legacy_workout_logging
3. see if there are pictures like this https://rdsdz.rochack.org/dumbbell-muscles-worked-dumbbell-workouts-25-best-exercises-routines-for-muscle-gain/ available for free
4. more train puns and look, we're called the gains train damnit
5. check for hardcoded things that repeat and replace them with variables (DRY)
6. Are we applying KISS?
7. Do we not have a shitload of redundant code?
8. Walk me through every bit step by step, I'll decide whatever needs documenting or not
9. Document the highover flow in a mermaid diagram
10. Let's make the history thing a calendar
11. Are we making sure that we're going for absolutely minimal clicks? Once you open the app for the first time, you should be asked a few questions. So opening the app if you've already configured that you're going for a standard set of exercises for a standard set of days should result in the app checking what your last day was and opening the new day already with the first exercise and your weights and reps for that first set already prefilled. You only have to press an button to confirm that this was your performance now to move on to the next set, which also has your weight and reps from the previous second set prefilled.
