# gains-train

Mobile-first workout tracker: exercise library, live workout logging, progress charts and PRs.

An Android app. Everything lives **on your phone**: no accounts, no server, and nothing is
ever sent anywhere. It's a web app (React + TypeScript, Vite, Tailwind) packaged for Android
with Capacitor, keeping its data in IndexedDB (via [Dexie](https://dexie.org)). Friends who
want to track their own progress just install it on their own phone.

How it fits together, in three diagrams: [docs/how-it-works.md](docs/how-it-works.md).

## Develop

```bash
scripts/dev.sh   # → http://localhost:5173
```

It checks and sets up everything it needs (Node 22, packages, the exercise library, the git
hooks) and starts the app. What each step does, the checks that run on commit and push, and
the handy commands are explained at the top of [scripts/dev.sh](scripts/dev.sh).

## Android app

The same app as an Android APK: fully offline, with no internet access at all.

```bash
scripts/android.sh
```

How it's built, how to install it on your phone, and where the app's id, icons and permissions
live: see the top of [scripts/android.sh](scripts/android.sh).

## Google Play

`scripts/android.sh --release` builds the signed app bundle to upload. Everything to fill in
on the Play Console (store listing texts, the answers for each form) is in
[docs/google-play.md](docs/google-play.md). Privacy policy: [PRIVACY.md](PRIVACY.md).

## Releases

Versions follow [semantic versioning](https://semver.org). On your branch, write what changed
under `[Unreleased]` in [CHANGELOG.md](CHANGELOG.md) and set the kind of release in
[release_scope.env](release_scope.env) (`major`, `minor`, `patch` or `none`). Merging to main
does the rest: a GitHub Action bumps the version everywhere, dates the changelog, tags the
release and resets `release_scope.env` to none. Details: [scripts/release.py](scripts/release.py).

## Your data: backups

Since the data only exists on the phone, losing the phone, uninstalling the app or clearing
its storage loses it. **Settings → Export backup** saves `gains-train-backup-YYYY-MM-DD.zip`
via the share sheet (e.g. to Google Drive); **Import backup** restores it on the same or a new
phone, replacing what's there. The zip holds CSV tables (workouts with one row per set,
routine, custom exercises, rest times, exercise preferences, dumbbells, settings), so every part
opens in a spreadsheet.

The app suggests a backup after a workout when the last one is half a year old (Settings →
Backup: every month, 3 months, 6 months, a year, or never).

## Credits

- Exercise drawings: [Workout Guide](https://github.com/bryllim/workout-guide) by Bryl Lim,
  based on [Everkinetic](https://github.com/everkinetic/data), licensed
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The app recolours them to
  its theme; they stay under that licence.
- Exercise details (muscles, equipment): [free-exercise-db](https://github.com/yuhonas/free-exercise-db)
  (public domain). For how to do an exercise, the app points to coaches on YouTube.

# TODO:
1. Find a way to improve upon the images representing exercises.
2. do we want to see during a workout, besides the previous weight, the all time best? So that you know what your best was? With the option to edit it if you realize your form was off in that best or something?
3. achievements: night train, early bird (other pun?), record activity x days in a row (multiple times earning a badge? Repeatable passport stamp), holiday related things (acitvity on new years day, etc.), obscure app functionality usage things (e.g. usage of the exercise preferences)
4. make switch to toggle light and dark mode in settings
