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
[RELEASE](RELEASE) (`major`, `minor`, `patch` or `none`). Merging to main does the rest: a
GitHub Action bumps the version everywhere, dates the changelog, tags the release and resets
`RELEASE` to none. Details: [scripts/release.py](scripts/release.py).

## Your data: backups

Since the data only exists on the phone, losing the phone, uninstalling the app or clearing
its storage loses it. **Settings → Export backup** saves `gains-train-backup-YYYY-MM-DD.zip`
via the share sheet (e.g. to Google Drive); **Import backup** restores it on the same or a new
phone, replacing what's there. The zip holds CSV tables (workouts with one row per set,
routine, custom exercises, rest times, settings), so every part opens in a spreadsheet.

The app suggests a backup after a workout when the last one is half a year old (Settings →
Backup: every month, 3 months, 6 months, a year, or never).

## Credits

- Exercise drawings: [Workout Guide](https://github.com/bryllim/workout-guide) by Bryl Lim,
  based on [Everkinetic](https://github.com/everkinetic/data), licensed
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The app recolours them to
  its theme; they stay under that licence.
- Exercise instructions and muscles: [free-exercise-db](https://github.com/yuhonas/free-exercise-db)
  (public domain), plus our own for the exercises it doesn't have.

## TODO

1. Create the upload key and point Gradle at it (top of `scripts/android.sh`), and back up
   the key file and its password somewhere safe.
2. Get a Google Play developer account (personal, one-time $25, ID check).
3. Make the store graphics: 512 × 512 icon, 1024 × 500 feature graphic, at least 2 phone
   screenshots (see [docs/google-play.md](docs/google-play.md)).
4. Pick the contact email for the store listing (it's public).
5. Create the app in the Play Console and fill in the store listing and the App content
   forms from [docs/google-play.md](docs/google-play.md). Push `PRIVACY.md` to main first:
   the privacy policy link points there.
6. Upload `scripts/android.sh --release`'s bundle to a closed test track and get 12 testers to
   opt in and install; keep all of them in for 14 days in a row.
7. Apply for production access, and publish after Google's review.

## TODOs for the app itself:
4. Can we make the passport stamps or any other circle look like train wheels with the connecting iron rod?
5. Can we make puns with coal and steam train and stuff?
