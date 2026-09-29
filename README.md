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

## Your data: backups

Since the data only exists on the phone, losing the phone, uninstalling the app or clearing
its storage loses it. In the app, **Settings → Export backup** saves a `gains-train-backup-YYYY-MM-DD.json` file
(on a phone via the share sheet, e.g. to Google Drive or Files); **Import backup** restores
it, on the same or a new phone (it replaces what's there). A new phone's first screen also
offers "Restore a backup".

## Credits

- Exercise drawings: [Workout Guide](https://github.com/bryllim/workout-guide) by Bryl Lim,
  based on [Everkinetic](https://github.com/everkinetic/data), licensed
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The app recolours them to
  its theme; they stay under that licence.
- Exercise instructions and muscles: [free-exercise-db](https://github.com/yuhonas/free-exercise-db)
  (public domain), plus our own for the exercises it doesn't have.

## TODO:
1. app id `io.github.wijnandvdm.gainstrain` = good?
2. store name `Gains Train - Workout Tracker` seems fine
3. semantic versioning and changelog
4. ask the user if they want to locally back up once in a while, if they answer yes, just run the export functionality. speaking of, can it not be in csv? that's a bit more user friendly than json
