# How gains-train works

gains-train is an Android app without a server: a web app packaged with Capacitor, and
everything you log stays on your phone. These three diagrams go from the big picture to a
single tap.

## 1. The big picture

Where the code, the exercise library and your data live, from building to running.

```mermaid
flowchart TB
  subgraph build["Building (on the VM)"]
    direction TB
    WG["Workout Guide<br/>302 drawn exercises"] --> BX["scripts/fetch-exercises.sh<br/>+ build-exercises.mjs"]
    FED["free-exercise-db<br/>instructions, muscles"] --> BX
    MAP["scripts/exercise-map.json<br/>which is which"] --> BX
    BX --> LIB["public/exercises/<br/>exercises.json + drawings"]
    SRC["frontend/src<br/>React app"] --> VITE["npm run build"]
    LIB --> VITE
    VITE --> DIST["dist/<br/>static files"]
    DIST --> APK["scripts/android.sh<br/>Android app (APK)"]
  end

  subgraph phone["On your phone"]
    direction TB
    UI["Screens<br/>pages/ + components/"]
    HOOKS["Hooks<br/>workout/hooks.ts, stats.ts, line.ts, …"]
    DATA["Data layer<br/>data/*.ts: workouts, stats, routine,<br/>streak, passport, backup"]
    DB[("IndexedDB, via Dexie<br/>workouts · routine · settings<br/>rest times · custom exercises")]
    LIBC["Exercise library<br/>data/library.ts"]
    UI -- "reads (live)" --> HOOKS
    HOOKS --> DATA
    UI -- "writes: start, log a set, finish" --> DATA
    DATA <--> DB
    DATA --> LIBC
  end

  APK -. installs .-> phone
  DATA <-- "Settings: export / import" --> BACKUP[/"backup file (.zip of CSVs)"/]
```

- **No server, no accounts.** The app talks to nothing but its own files, and doesn't even
  have internet permission.
- **Screens update by themselves.** Hooks use Dexie's live queries: when anything changes in
  the database, every screen showing it re-renders. Nothing is refetched or synced.
- **Derived, not stored.** Stats, records, the Gains Line streak and the passport are worked
  out from your workouts each time, so restored history counts and edits never go stale.
- **Backups are yours.** The export file is the only way data leaves the phone.

## 2. Your route through the app

```mermaid
flowchart TD
  OPEN([Open the app]) --> FIRST{First time?}
  FIRST -- yes --> SETUP["Setup<br/>restore a backup, or:<br/>how you train · rest between sets"]
  FIRST -- no --> WORKOUT
  SETUP --> WORKOUT["Workout tab<br/>next station card · next routine day"]
  WORKOUT -- "✓ Done on set 1" --> ACTIVE["Workout in progress<br/>focus card: set 2/3, prefilled from last time"]
  ACTIVE -- "✓ Done" --> REST["Rest timer · 🏆 PR badge"]
  REST --> ACTIVE
  ACTIVE -- Finish --> DONE["End of the line!<br/>workout saved · new passport stamps"]
  DONE --> HISTORY["History<br/>calendar with stations · week results"]
  DONE --> PROGRESS["Progress<br/>passport · exercises by routine day"]
  PROGRESS --> EXERCISE["Exercise page<br/>drawing · muscles · records · chart"]
  WORKOUT --> SETTINGS["Settings<br/>rest timer · weekly target · depot<br/>routine · backup"]
```

## 3. Logging one set

What happens behind the scenes when you tap ✓ Done.

```mermaid
sequenceDiagram
  actor You
  participant Card as Focus card
  participant Data as data/workouts.ts
  participant DB as IndexedDB
  participant Screens as Screens (live queries)

  You->>Card: tap ✓ Done (38 kg × 8)
  Card->>Data: saveSet()
  Card->>Card: start the rest timer
  Data->>DB: update the workout
  DB-->>Screens: something changed
  Screens->>DB: read again
  Screens-->>You: set ticked · next set 2/3 · 🏆 if it's a record · progress
```

Everything on the right happens on the phone in a few milliseconds; there's no network in
between.
