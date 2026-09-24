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
cp .env.example .env        # first time only
uv run uvicorn app.main:app --reload --port 8001

# 3. Frontend → http://localhost:5173 (proxies /api to the API)
cd frontend
npm install                 # first time only
npm run dev
```

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
cd frontend && npm run build && npm run lint
```
