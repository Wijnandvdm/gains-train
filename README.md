# gains-train

Mobile-first workout tracker: exercise library, live workout logging, progress charts and PRs.

Everything lives **on your phone**: no accounts, no server, and nothing is ever sent anywhere.
The app is plain static files (React + TypeScript, Vite, Tailwind), installable as a PWA, and
keeps its data in the browser's IndexedDB (via [Dexie](https://dexie.org)). Friends who want to
track their own progress just open the same app on their own phone.

## Prerequisites

- Node 22 (`nvm install 22`)

## Run locally

```bash
scripts/dev.sh   # → http://localhost:5173
```

The first run installs the frontend packages and builds the exercise library into
`frontend/public/exercises/` (~19 MB, not committed; `scripts/fetch-exercises.sh`):

- **302 exercises with uniform line drawings** (a start and an end pose) from
  [Workout Guide](https://github.com/bryllim/workout-guide) by Bryl Lim, based on
  [Everkinetic](https://github.com/everkinetic/data), licensed
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The app recolours them to
  its theme; they stay under that licence, and Settings → About credits them.
- **Instructions and detailed muscles** from
  [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain) for the 158
  exercises it also has, matched by hand in `scripts/exercise-map.json`. Those keep their
  free-exercise-db id, so data logged with the earlier, photo-based library stays linked; an
  exercise that left the library becomes a custom exercise on first open
  (`frontend/src/data/migrate.ts`).

Both sources are pinned to a commit; `scripts/build-exercises.mjs` combines them.

## Build and host

```bash
cd frontend
npm run build     # → frontend/dist/, the whole app including the exercise drawings
npm run preview   # try the production build → http://localhost:4173
```

Serve `frontend/dist/` from any static host (or this VM), with unknown paths falling back to
`index.html` (app routes like `/history` are handled in the browser). Installing it on a phone
needs HTTPS, e.g. Tailscale or a Cloudflare Tunnel in front of the VM.

- The app and the exercise list are cached up front, so it opens instantly and works offline;
  each exercise drawing is cached the first time it's shown.
- A new deploy shows a "New version available · Reload" banner instead of reloading mid-workout.
- App icons are generated from `frontend/public/favicon.svg`: `npx @vite-pwa/assets-generator@1`.

## Android app

The same app, wrapped with [Capacitor](https://capacitorjs.com) into an APK with everything
inside (exercise drawings included), so it works fully offline. It has no internet access at
all (the permission is removed in `AndroidManifest.xml`), so nothing can leave the phone.

One-time setup on the build machine (Linux): Java 21 and the Android command-line tools.

```bash
sudo apt install openjdk-21-jdk-headless unzip
# Unpack https://developer.android.com/studio#command-line-tools-only into
# ~/android-sdk/cmdline-tools/latest, then:
~/android-sdk/cmdline-tools/latest/bin/sdkmanager --licenses
~/android-sdk/cmdline-tools/latest/bin/sdkmanager "platforms;android-36" "build-tools;36.0.0" "platform-tools"
```

Build (the web app, then the APK):

```bash
scripts/android.sh   # → frontend/android/app/build/outputs/apk/debug/gains-train.apk
```

Each build is also copied to `~/repos/apk_versions/` (or `$APK_DIR`) as
`gains-train-<date>-<time>-<commit>.apk`, with `-dirty` when there were uncommitted changes.

Install it by copying the APK to the phone over USB ("File transfer") and opening it there
(allow "Install unknown apps" for your file manager once). Installing a newer build over it
keeps your data. The app's ids and icons live in `frontend/capacitor.config.ts` and
`frontend/assets/` (icons regenerate with `npx @capacitor/assets generate --android`).

### Checking the Android app

The app runs the same code as the web version, and the automated tests (Vitest) cover that.
Only the thin Android layer around it isn't tested automatically, so after changing that
layer (`capacitor.config.ts`, `frontend/android/`, the Capacitor version) or before a release,
install the new APK on your phone and check (a couple of minutes):

- [ ] The header and the bottom tabs are clear of the status bar and the navigation bar.
- [ ] The Android back button goes back a page (and closes the app on the first screen).
- [ ] Settings → **Export backup** opens the share sheet, and saving to Drive/Files works.
- [ ] Settings → **Import backup** opens the file picker and restores the file.
- [ ] Installing the new APK over the old one keeps your workouts.
- [ ] Exercise drawings and the exercise list load (the app has no internet access).

Once the app is on Google Play, its free **pre-launch report** also runs every upload on
real devices and reports crashes and screenshots.

## Your data: backups

Since the data only exists on the phone, losing the phone or clearing the site's data loses
it. In the app, **Settings → Export backup** saves a `gains-train-backup-YYYY-MM-DD.json` file
(on a phone via the share sheet, e.g. to Google Drive or Files); **Import backup** restores
it, on the same or a new phone (it replaces what's there). A new phone's first screen also
offers "Restore a backup".

Add the app to your home screen: browsers (especially Safari) may clear data of websites you
haven't opened for a while, but not of installed apps. Settings shows whether the phone has
granted persistent storage.

## Importing the legacy Google Sheets log

Export the sheet's **Log** tab as CSV and pick it under **Settings → Import your old sheet**
(or "Import my old sheet" on first open). Re-importing is safe: workouts are updated, not
duplicated. Exercise names are mapped to the library by `LEGACY_MAPPING` in
[`legacyImport.ts`](frontend/src/data/legacyImport.ts).

## Checks

[pre-commit](https://pre-commit.com) runs formatting, linting, type checks and secret scanning on
every commit, and the test suite on every push:

```bash
pre-commit install          # first time only; installs commit + push hooks
pre-commit run --all-files  # run everything manually
```

Or run the tools directly:

```bash
cd frontend && npm test && npm run lint && npm run build
```

## TODOS:
1. check for hardcoded things that repeat and replace them with variables (DRY), e.g. with light and dark mode, hex color codes, string values, etc.
2. Are we applying KISS?
3. Do we not have a shitload of redundant code?
4. Walk me through every bit step by step, I'll decide whatever needs documenting or not
5. Document the highover flow in a mermaid diagram
6. Get a how to section for the exercises that do not have one now
7. Having done all exercises in the library absolutely deserves an achievement
