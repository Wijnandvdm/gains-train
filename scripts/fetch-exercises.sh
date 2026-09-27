#!/usr/bin/env bash
# Build the exercise library into frontend/public/exercises/ (~16 MB): the drawn exercises of
# Workout Guide (https://github.com/bryllim/workout-guide, drawings CC BY-SA 4.0), with
# instructions and muscles from free-exercise-db (https://github.com/yuhonas/free-exercise-db,
# public domain) where they match (scripts/exercise-map.json). See scripts/build-exercises.mjs.
# The app serves these as static files. Both sources are pinned, so everyone gets the same
# library. Skips the work when that version is already there. Usage: scripts/fetch-exercises.sh [--force]
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
FED_COMMIT=a859101d633a01c4a1a920d6a8ce41dabba0705f
WG_COMMIT=aac599224bb9780305239607ef98540b7e0ce389
target="$root/frontend/public/exercises"
# Rebuild when a source, the mapping or the build script changes.
version="$FED_COMMIT $WG_COMMIT $(cat "$root/scripts/exercise-map.json" "$root/scripts/build-exercises.mjs" | sha1sum | cut -c1-12)"

if [ "${1:-}" != "--force" ] && [ "$(cat "$target/VERSION" 2>/dev/null)" = "$version" ]; then
  echo "Exercise library already present"
  exit 0
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
echo "Downloading the exercise drawings and instructions…"
curl -fsSL -o "$tmp/free-exercise-db.json" \
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/$FED_COMMIT/dist/exercises.json"
# Stream the archive straight into tar, keeping only the manifest, licence and SVG drawings.
mkdir "$tmp/wg"
curl -fsSL "https://codeload.github.com/bryllim/workout-guide/tar.gz/$WG_COMMIT" |
  tar -xz -C "$tmp/wg" --strip-components=3 --wildcards \
    '*/packages/workout-guide/manifest.json' '*/packages/workout-guide/ATTRIBUTION.md' \
    '*/packages/workout-guide/LICENSE-ASSETS' '*/packages/workout-guide/assets/*/frame-*.svg'

"$root/scripts/frontend-run.sh" node "$root/scripts/build-exercises.mjs" \
  "$tmp/free-exercise-db.json" "$tmp/wg" "$root/scripts/exercise-map.json" "$tmp/out"
rm -rf "$target"
mv "$tmp/out" "$target"
echo "$version" > "$target/VERSION"
echo "Exercise library ready in ${target#"$root"/} ($(du -sh "$target" | cut -f1))"
