# Changelog

What changed in each version of gains-train. Write your changes under **[Unreleased]** as you
go; releasing (see `release_scope.env`) turns that section into the new version.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[semantic versioning](https://semver.org/).

## [Unreleased]

## [1.4.0] - 2026-11-28

### Added

- 148 more exercises, 450 in all: barbell staples (Barbell Curl, Box Squat, Floor Press, Zercher
  Squat), the Olympic lifts (Clean, Snatch, Clean and Jerk), kettlebell (Turkish Get-Up,
  Snatch, Windmill), calisthenics (Muscle-Up, Ring Dip, Rope Climb), strongman (Sled Push, Tire
  Flip, Yoke Walk) and many single-arm and single-leg variants. They have no drawing: their
  muscles show instead, front and back, also for your own exercises that have muscles.
- One way of naming every exercise (scripts/check-exercise-names.mjs), which tidies some names:
  Push-up is now Push-Up (also Pull-Up, Chin-Up), One-Arm Dumbbell Row is Single-Arm Dumbbell
  Row, Skullcrusher is Skull Crusher. Your logged workouts keep their exercises.

## [1.3.1] - 2026-11-23

### Changed

- The Off the beaten track stamps (Side-tracked, Your own exercise, Set up just right, Two
  dumbbells, In the depot, Railway roundhouse, Safe and sound) are earned once, like Laid the
  tracks: they're firsts, so they no longer count up (×5) with every workout.
- Rush hour (a workout started between 17:00 and 20:00) counts on weekdays only: at the
  weekend there are no commuters.

### Fixed

- Long workout names are no longer cut off during a workout: the name gets the full width and
  wraps onto a second line, with Finish below it next to the time and sets.

## [1.3.0] - 2026-11-22

### Added

- The privacy policy inside the app: Settings → About → Privacy policy. It reads offline, with a
  link to the online version.

## [1.2.0] - 2026-11-22

### Added

- PRs in your history: a past workout shows 🏆 PR or PR on the sets that set one, just as you
  saw them while lifting, and its card in History counts them (with the cup when one was your
  heaviest yet).
- Light or dark in Settings → Appearance: like the rest of your phone (as before), or always
  light or always dark. Backups include the choice.
- New passport stamps you can earn again and again (with a ×3 on the stamp): Night train and
  Early commute (your first one, a week that reaches your weekly goal with them, and 7 days in a
  row), the Marathon line (a workout of two hours or more), the Bullet train and the Maglev
  (your whole routine day, at least 2 sets of every exercise, in under 30 or 20 minutes), the
  Lunch break line (started between 11:30 and 13:30), Rush hour (between 17:00 and 20:00), the
  Return ticket and Back on track (your first workout after a break of 4 weeks, and your weekly
  goal reached that week), Burning coal (10 tonnes in one workout), Obstruction cleared (a PR
  after a plateau of 8 weeks), Double track (twice your starting weight on an exercise), Express
  (3, 5 or 7 days in a row, the Weekend express: Saturday and Sunday, the Blue Monday line: 4
  Mondays in a row, and the Double decker: two workouts on one day), Holiday specials (New
  Year's Day, Easter, King's Day, Christmas, the leap day, Friday the 13th, Pi Day, Halloween,
  the Polar Express on all three days of Christmas, and your gym birthday) and Off the beaten
  track (your routine, Side-tracked: an exercise that isn't in the routine day, your own
  exercise, exercise preferences, two dumbbells, the depot, the Railway roundhouse: 4 weeks in a
  row in the depot, a backup), the Train yard (every 10 workouts with a barbell, dumbbells, a
  cable, the Smith machine or a kettlebell, and all five of them in one month: Network newbie,
  or in one week: Network navigator). Workouts in a week parked in the depot earn no stamps.
  After a workout the app tells you when one was stamped again. Tickets on the Gains Line get
  stamps too: Ticket to ride (your first), Two-way ticket (holding two) and Overbooked (a ticket
  with no room left for it). Tap a stamp to see whether you can earn it again.
- Stamps for collecting stamps: Trainspotter (10), Railway Baron (50), Track Tycoon (75), Last
  stop before the terminus (all but 5) and End of the line (every one).
- A past workout shows when you started and finished, and how long it took (18:05–19:17 · 1 h
  12 min).
- The ride stamps have names, ever longer rides: from Conductor in training (your first ride)
  through the Glacier Express (100) and the Orient Express (250) to the Trans-Siberian (500).
  The famous rides tell where they went.
- Stamps for the big three: bench press, squat and deadlift each at 60 kg (Branch line), 80
  (Main line), 100 (Heavy freight) and 120 kg (Iron horse). The next one shows how many of the
  three are there already (2/3).

### Changed

- The little trains in the app (the header, the workout track, a finished workout and the
  setup screen) are now the app's logo: the flexing locomotive.
- The setup screen says what restoring a backup brings back: workouts, routine, your own
  exercises, exercise preferences, dumbbells, rest times and settings.
- The muscle map: the main muscles are deep red and the ones that help orange, so the two
  are easy to tell apart (in dark mode it was a light and a dark red, the wrong way around).

### Removed

- Importing the old .json backups: only the .zip backups can be restored.

## [1.1.0] - 2026-11-19

### Added

- Full steam ahead stamps in the passport: one exercise stronger every week, 3, 4, 6 or 8
  weeks in a row (heavier, or more reps than the week before).
- Coal and steam: more cheers after a set, and after a workout the weight you moved,
  shovelled into the firebox (plus a word from the boiler when you set a record).
- Edit a past workout: change a set's weight or reps, remove sets you didn't do, or add one
  you forgot. Records, charts, the Gains Line and stamps follow.
- On an exercise's page, tap a row of the progress table or of the rep records to open that
  workout.
- From the Progress tab, an exercise opens straight at its progress (records and chart).
- Tap a passport stamp for what it's for, and when you earned it or how far you are.
- Search finds exercises by the muscle they train, not just by name: "abs", "chest", "quads",
  or slang like "booty" and "guns".
- Time filters for an exercise's progress chart (3 months, 1 year, … All) that grow with your
  data: only the ones shorter than your history, none until there are 3 months to filter. It
  opens on the last year once you have more than a year; records stay all-time.
- Your own exercises, for what the library doesn't have: make one right from the exercise
  picker (or Exercises → New exercise) with a name and main muscle. Rename it, or delete it
  while you haven't used it.
- When an update adds an exercise that looks like one of your own, the Workout screen asks
  whether to use the new one from now on; yes moves your workouts, records and preferences
  over to it.
- Exercise preferences per exercise (Seat 4, Pad L, −1): on the set card until the first set
  is done (⚙ shows them again), and changeable there, in the routine editor or on the
  exercise's page. Backups include them (backup format 3).
- One or two dumbbells, per exercise: choose on its page whether you log one dumbbell, the
  weight of each of two, or the total. The set card says "kg each" or "kg total", and volume
  counts both dumbbells when you log each.
- Change a workout on the go: drag an exercise up or down by its ≡ (what's next follows the
  new order). In a routine workout, reordering, adding or removing an exercise asks whether
  to make it your routine from now on; ignore it and it goes away, nothing changed.
- Before you start a routine day, drag its exercises into today's order, or add one to start
  with; the set card follows, and it asks whether to make it your routine.

### Changed

- No more written how-to steps on an exercise's page: it points you to Jeff Nippard, Mike
  Israetel, Dom Mazzetti and Eric Janicki on YouTube for good form instead.
- If you moved the weight up during an exercise last time, the next time starts at the weight
  you ended on, and the card shows how it went ("last time 10 × 12 → 15 × 8").
- A new look: the muscle-train logo as the app icon and splash screen, and the app in its
  reds, from the header to ✓ Done. The main buttons are a shade darker, so their text reads
  well, and error messages and warm-up sets have readable colours in dark mode too.
- The Gains Line is about your weekly goal, in time: "Only 1 more workout to reach this
  week's goal of 3!", weeks in a row, and milestones ("Two weeks in a row! Keep going for a
  month."). On the Workout screen it's one slim line now (tap it for the details), so your
  workout comes first.
- The calendar's week column is a track, like a metro map: each week reached is a ring on
  the line, and a missed week breaks it.
- History's calendar shows each week filling up instead of a colour per routine day: a
  day's ring fills with the week's rides so far (a third, two thirds, …) and the ride that
  reaches the week's goal closes it.
- No more legends in History: tap a week marker or the streak and ticket pills for what they
  mean that week, in a small bubble; a selected day says which ride of the week it was. The
  week and streak bubbles link straight to your weekly goal in Settings.
- Volume per set instead of total volume: an exercise's progress chart opens on it, the Best
  session record is the best volume per set, and the Progress tab shows your average per set.
  So more sets alone don't count as progress. Estimated 1RM comes last, in the chart and in
  the records.

### Fixed

- Your last weight and reps are filled in again after you skipped an exercise: a skipped
  session no longer counts as "last time", however long ago you last did it.
- When a screen crashes, a friendly screen says so (your data is safe), with Try again and
  Go to Workout, instead of a developer message; the tabs stay, so you can tap away.
- The phone's back button goes back to the previous screen; before, it closed the app on any
  screen. On the first screen it puts the app in the background, keeping a rest timer or a
  workout in progress.
- Weights of 100 kg and more fit in the workout's set card; longer numbers (102.5) shrink to
  fit instead of being cut off.

## [1.0.0] - 2026-09-29

### Added

- Log workouts on your phone: one tap per set, prefilled from last time, with a rest timer.
- Your routine: the next day is ready when you open the app.
- History as a calendar, progress per exercise with records and charts.
- The Gains Line: a weekly streak with stations, tickets and a depot for holidays.
- A passport with stamps for rides, weight hauled, PRs, streaks and exercises explored.
- 302 exercises with drawings and how-to steps.
- Backups as a zip of spreadsheets (CSV), with a reminder every half year.
- Everything stays on your phone: no account, no internet access.
