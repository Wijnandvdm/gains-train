#!/usr/bin/env bash
# Regenerate frontend/src/api/schema.d.ts from the FastAPI app's OpenAPI spec.
# Run after changing backend routes or schemas (pre-commit does this automatically).
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
spec="$(mktemp --suffix=.json)"
trap 'rm -f "$spec"' EXIT

# Importing the app doesn't connect to the database, so this works without Postgres.
(cd "$root/backend" && uv run python -c \
  'import json; from app.main import app; print(json.dumps(app.openapi()))') > "$spec"

# openapi-typescript needs TypeScript 5 while the project uses 6, so it runs in isolation
# via npx (pinned) instead of being a project dependency.
"$root/scripts/frontend-run.sh" npx --yes openapi-typescript@7.13.0 "$spec" \
  --output src/api/schema.d.ts --root-types --root-types-no-schema-prefix
"$root/scripts/frontend-run.sh" npx prettier --write --log-level warn src/api/schema.d.ts
