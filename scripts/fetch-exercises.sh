#!/usr/bin/env bash
# Download the exercise library (https://github.com/yuhonas/free-exercise-db, public domain)
# into frontend/public/exercises/: exercises.json + a start/end photo per exercise (~100 MB).
# The app serves these as static files. Pinned to one commit so everyone gets the same data.
# Skips the download when that version is already there. Usage: scripts/fetch-exercises.sh [--force]
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
COMMIT=a859101d633a01c4a1a920d6a8ce41dabba0705f
target="$root/frontend/public/exercises"

if [ "${1:-}" != "--force" ] && [ "$(cat "$target/VERSION" 2>/dev/null)" = "$COMMIT" ]; then
  echo "Exercise library already present ($COMMIT)"
  exit 0
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
echo "Downloading exercise library ${COMMIT:0:7} (~100 MB)…"
# Stream the archive straight into tar, keeping only the JSON and the photos.
curl -fsSL "https://codeload.github.com/yuhonas/free-exercise-db/tar.gz/$COMMIT" |
  tar -xz -C "$tmp" --strip-components=1 --wildcards '*/dist/exercises.json' '*/exercises/*/*.jpg'

rm -rf "$target"
mkdir -p "$target"
mv "$tmp/dist/exercises.json" "$target/exercises.json"
mv "$tmp/exercises/"* "$target/"
echo "$COMMIT" > "$target/VERSION"
echo "Exercise library ready: $(ls -d "$target"/*/ | wc -l) exercises in ${target#"$root"/}"
