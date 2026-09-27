#!/usr/bin/env bash
# Build the Android app (APK) with everything inside, exercise photos included, so it works
# fully offline. Needs Java 21 and the Android SDK (default ~/android-sdk; see the README).
#   scripts/android.sh   → frontend/android/app/build/outputs/apk/debug/gains-train.apk
# Every build is also kept in ~/repos/apk_versions (or $APK_DIR), named after when and from
# which commit it was built, e.g. gains-train-2026-09-26-1432-8d49cd4.apk ("-dirty" when
# there were uncommitted changes).
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}"

say() { printf '\033[1;32m▸ %s\033[0m\n' "$*"; }

scripts/fetch-exercises.sh # does nothing when already downloaded

# Capacitor's command-line tool shares anonymous usage data unless told otherwise.
scripts/frontend-run.sh npx cap telemetry off >/dev/null

say "Building the web app"
scripts/frontend-run.sh npx tsc -b
scripts/frontend-run.sh npx vite build --mode android
scripts/frontend-run.sh npx cap sync android

say "Building the APK"
(cd frontend/android && ./gradlew --quiet assembleDebug)
apk=frontend/android/app/build/outputs/apk/debug
mv "$apk/app-debug.apk" "$apk/gains-train.apk"
say "Done: $apk/gains-train.apk ($(du -h "$apk/gains-train.apk" | cut -f1))"

versions="${APK_DIR:-$HOME/repos/apk_versions}"
mkdir -p "$versions"
commit="$(git rev-parse --short HEAD)"
[ -z "$(git status --porcelain)" ] || commit="$commit-dirty"
copy="$versions/gains-train-$(date +%Y-%m-%d-%H%M)-$commit.apk"
cp "$apk/gains-train.apk" "$copy"
say "Copy: $copy"
