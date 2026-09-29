#!/usr/bin/env bash
# Build the Android app with one command:   scripts/android.sh
#   → frontend/android/app/build/outputs/apk/debug/gains-train.apk
#
# The same app as the web version, wrapped with Capacitor (capacitorjs.com). The APK has
# everything inside (the exercise drawings too), so it works fully offline. The script checks
# and sets up what it needs first; each step does nothing when it's already done.
#
#   1-3.           Node 22, the packages and the exercise library: see scripts/setup-frontend.sh
#   4. Java 21     needed by Gradle. Checked only: install it yourself when asked
#                  (sudo apt install openjdk-21-jdk-headless).
#   5. Android SDK in $ANDROID_HOME (default ~/android-sdk): the command-line tools, the
#                  licences, and the Android platform the project compiles against (read from
#                  frontend/android/variables.gradle). Gradle fetches the build tools itself.
#   6. Build       the web app, copied into the Android project (cap sync), then packaged by
#                  Gradle.
#   7. Keep a copy every build is also kept in ~/repos/apk_versions (or $APK_DIR), named after
#                  when and from which commit it was built, e.g.
#                  gains-train-2026-09-26-1432-8d49cd4.apk ("-dirty": uncommitted changes).
#
# Install on your phone: copy the APK over USB ("File transfer") and open it there; allow
# "Install unknown apps" for your file manager once. Installing a newer build over it keeps
# your data.
#
# Where things live:
#   frontend/capacitor.config.ts   the app id (permanent once on Google Play) and name
#   frontend/assets/               icon and splash sources; after changing them:
#                                  npx @capacitor/assets generate --android  (in frontend/)
#   frontend/android/app/src/main/AndroidManifest.xml
#                                  no permissions, so no internet (nothing can leave the phone;
#                                  the build fails if one sneaks in, e.g. from a plugin) and
#                                  no Android cloud backup (data leaves only via Export backup)
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}"
# The command-line tools version to install when there's no SDK yet (developer.android.com/studio).
CMDLINE_TOOLS=16111833

say() { printf '\033[1;32m▸ %s\033[0m\n' "$*"; }
fail() {
  printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2
  exit 1
}

# 1-3. Node, packages, exercise library
scripts/setup-frontend.sh

# 4. Java
java_major="$(java -version 2>&1 | sed -nE '1s/.*version "([0-9]+).*/\1/p')"
[ "${java_major:-0}" -ge 21 ] ||
  fail "Java 21 is needed to build the app: sudo apt install openjdk-21-jdk-headless"

# 5. Android SDK
sdkmanager="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
if [ ! -x "$sdkmanager" ]; then
  command -v unzip >/dev/null ||
    fail "unzip is needed to set up the Android SDK: sudo apt install unzip"
  say "Downloading the Android command-line tools into $ANDROID_HOME"
  tmp="$(mktemp -d)"
  curl -fsSL -o "$tmp/tools.zip" \
    "https://dl.google.com/android/repository/commandlinetools-linux-${CMDLINE_TOOLS}_latest.zip"
  unzip -q "$tmp/tools.zip" -d "$tmp"
  mkdir -p "$ANDROID_HOME/cmdline-tools"
  mv "$tmp/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
  rm -rf "$tmp"
fi
platform="$(sed -nE 's/.*compileSdkVersion = ([0-9]+).*/\1/p' frontend/android/variables.gradle)"
if [ ! -d "$ANDROID_HOME/platforms/android-$platform" ]; then
  say "Installing Android platform $platform (and accepting the SDK licences)"
  yes | "$sdkmanager" --licenses >/dev/null 2>&1 || true
  "$sdkmanager" "platforms;android-$platform" >/dev/null
fi

# Capacitor's command-line tool shares anonymous usage data unless told otherwise.
scripts/frontend-run.sh npx cap telemetry off >/dev/null

# 6. Build
say "Building the web app"
scripts/frontend-run.sh npx tsc -b
scripts/frontend-run.sh npx vite build
scripts/frontend-run.sh npx cap sync android

say "Building the APK"
(cd frontend/android && ./gradlew --quiet assembleDebug)
apk=frontend/android/app/build/outputs/apk/debug
mv "$apk/app-debug.apk" "$apk/gains-train.apk"

# The app promises no internet access: stop if the finished APK asks for it anyway (a new
# plugin can add permissions through its own manifest).
aapt2="$(find "$ANDROID_HOME/build-tools" -name aapt2 | sort -V | tail -1)"
if "$aapt2" dump permissions "$apk/gains-train.apk" | grep -q "android.permission.INTERNET"; then
  fail "The app asks for internet access (a plugin added it?): $aapt2 dump permissions $apk/gains-train.apk"
fi
say "Done: $apk/gains-train.apk ($(du -h "$apk/gains-train.apk" | cut -f1))"

# 7. Keep a copy
versions="${APK_DIR:-$HOME/repos/apk_versions}"
mkdir -p "$versions"
commit="$(git rev-parse --short HEAD)"
[ -z "$(git status --porcelain)" ] || commit="$commit-dirty"
copy="$versions/gains-train-$(date +%Y-%m-%d-%H%M)-$commit.apk"
cp "$apk/gains-train.apk" "$copy"
say "Copy: $copy"
