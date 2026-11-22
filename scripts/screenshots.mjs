// The Play Store screenshots: fills the app with demo data, then photographs each screen.
// Started by scripts/screenshots.sh (which runs the app and a headless Chrome):
//   node scripts/screenshots.mjs <app url> <Chrome debugging port> <light|dark> <output dir>
// It drives Chrome over the DevTools protocol, with Node's own WebSocket: no extra packages.
import fs from "node:fs";

const [app, cdpPort, theme, outDir] = process.argv.slice(2);

// --- The screens -------------------------------------------------------------------------
// [file name, path, what to do there first (runs in the page)]. `{lastWorkout}` in a path is
// the most recent demo workout. The workout being logged goes last: it starts a workout, which
// changes the Workout and History screens.
const BENCH = "/exercises/Barbell_Bench_Press_-_Medium_Grip";
const SHOTS = [
  ["1-workout", "/workout"],
  ["2-history", "/history"],
  ["3-workout-detail", "/history/{lastWorkout}"],
  ["4-progress", "/progress"],
  [
    "5-passport",
    "/progress",
    `click('Show all stamps'); await pause(); scrollTo('Odd hours', 120)`,
  ],
  ["6-exercise", BENCH],
  ["7-muscles", BENCH, `scrollTo('Muscles worked', 90)`],
  [
    "8-chart",
    BENCH,
    `click('Top weight'); await pause(); scrollTo('Your progress', 60)`,
  ],
  [
    "9-logging",
    "/workout",
    `click('✓ Done'); await pause(); click('✓ Done'); await pause()`,
  ],
];

// Helpers for those actions: tap a button or link by its text, scroll a heading into view.
const HELPERS = `
  const pause = () => new Promise((r) => setTimeout(r, 800))
  const click = (text) => {
    const el = [...document.querySelectorAll('button, a')].find((b) =>
      b.textContent.trim().toLowerCase().startsWith(text.toLowerCase()))
    if (!el) throw new Error('Nothing to click: ' + text)
    el.click()
  }
  const scrollTo = (text, above) => {
    const el = [...document.querySelectorAll('main *')].find(
      (e) => e.children.length === 0 && e.textContent.trim() === text)
    if (!el) throw new Error('Not on the screen: ' + text)
    el.scrollIntoView()
    window.scrollBy(0, -above)
  }
`;

// --- The demo data -----------------------------------------------------------------------
// Runs in the page, with the app's own database module. Three months of push/pull/legs on
// Mondays, Wednesdays and Fridays (and every other Saturday), up to yesterday, getting a bit
// stronger every other session; at varied times of day, so odd-hours stamps show up too.
const SEED = `(async () => {
  const { db, updateSettings } = await import('/src/data/db.ts')
  const day = (id, name, exercises) => ({ id, name, exercises: exercises.map(([exercise_id, sets]) => ({ exercise_id, sets })) })
  const routine = { days: [
    day('push', 'Push · Chest & Shoulders', [['Barbell_Bench_Press_-_Medium_Grip', 4], ['Incline_Dumbbell_Press', 3],
      ['Seated_Dumbbell_Press', 3], ['Side_Lateral_Raise', 3], ['Triceps_Pushdown', 3]]),
    day('pull', 'Pull · Back & Biceps', [['Barbell_Deadlift', 3], ['Wide-Grip_Lat_Pulldown', 3],
      ['Bent_Over_Barbell_Row', 3], ['Seated_Cable_Rows', 3], ['Hammer_Curls', 3]]),
    day('legs', 'Legs', [['Barbell_Full_Squat', 4], ['Leg_Press', 3], ['Romanian_Deadlift', 3],
      ['Lying_Leg_Curls', 3], ['Standing_Calf_Raises', 3]]),
  ] }
  // exercise → [starting kg, kg added every other session, reps]
  const plan = {
    'Barbell_Bench_Press_-_Medium_Grip': [62.5, 2.5, 8], Incline_Dumbbell_Press: [20, 2, 10],
    Seated_Dumbbell_Press: [16, 2, 10], Side_Lateral_Raise: [8, 1, 12], Triceps_Pushdown: [25, 2.5, 12],
    Barbell_Deadlift: [90, 5, 6], 'Wide-Grip_Lat_Pulldown': [45, 2.5, 10], Bent_Over_Barbell_Row: [50, 2.5, 10],
    Seated_Cable_Rows: [55, 2.5, 12], Hammer_Curls: [12, 1, 10], Barbell_Full_Squat: [75, 2.5, 8],
    Leg_Press: [140, 10, 10], Romanian_Deadlift: [60, 2.5, 10], Lying_Leg_Curls: [35, 2.5, 12],
    Standing_Calf_Raises: [60, 5, 15],
  }
  const pad = (n) => String(n).padStart(2, '0')
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const monday = (d) => { const m = new Date(d); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return m }
  const first = monday(today); first.setDate(first.getDate() - 13 * 7)
  const depot = new Date(first); depot.setDate(depot.getDate() + 7 * 7) // a week off, in the depot

  const workouts = []
  const sessions = { push: 0, pull: 0, legs: 0 }
  for (const d = new Date(first); d < today; d.setDate(d.getDate() + 1)) {
    const weekday = d.getDay()
    const week = Math.round((monday(d) - first) / (7 * 864e5))
    if (![1, 3, 5].includes(weekday) && !(weekday === 6 && week % 2)) continue
    if (ymd(monday(d)) === ymd(depot)) continue
    const n = workouts.length + 1
    const r = routine.days[(n - 1) % 3]
    const k = sessions[r.id]++
    const hour = weekday === 6 ? 10 : n % 7 === 0 ? 6 : n % 5 === 0 ? 12 : n % 11 === 0 ? 21 : 18
    const start = new Date(d); start.setHours(hour, (n % 4) * 10)
    let t = start.getTime() + 4 * 60e3
    const id = 'demo-' + n
    const exercises = r.exercises.map((e, i) => {
      const [base, step, reps] = plan[e.exercise_id]
      const weId = id + '-' + i
      return { id: weId, exercise_id: e.exercise_id, position: i + 1, notes: null,
        sets: Array.from({ length: e.sets }, (_, s) => {
          t += (2.5 + (s % 2)) * 60e3
          return { id: weId + '-' + s, workout_exercise_id: weId, position: s + 1,
            weight_kg: base + Math.floor(k / 2) * step,
            reps: reps - (s === e.sets - 1 && k % 2 ? 1 : 0), // the last set is a struggle
            is_warmup: false, notes: null, completed_at: new Date(t).toISOString() }
        }) }
    })
    workouts.push({ id, name: r.name, routine_day_id: r.id, performed_on: ymd(start), status: 'completed',
      started_at: start.toISOString(), ended_at: new Date(t + 3 * 60e3).toISOString(), notes: null,
      import_key: null, exercises, exercise_ids: exercises.map((e) => e.exercise_id) })
  }
  const backup = new Date(today); backup.setDate(backup.getDate() - 7); backup.setHours(20)

  await db.workouts.clear()
  await db.workouts.bulkPut(workouts)
  await db.kv.put({ key: 'routine', value: routine })
  await updateSettings({ setup_completed_at: first.toISOString(), theme: '${theme}', weekly_target: 3,
    depot_weeks: [ymd(depot)], last_backup_at: backup.toISOString() })
  localStorage.setItem('gains-train-theme', '${theme}')
  return workouts.at(-1).id
})()`;

// --- Chrome ------------------------------------------------------------------------------
const tabs = await (
  await fetch(`http://127.0.0.1:${cdpPort}/json/list`)
).json();
const ws = new WebSocket(
  tabs.find((t) => t.type === "page").webSocketDebuggerUrl,
);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
let nextId = 0;
const waiting = new Map();
ws.onmessage = (message) => {
  const reply = JSON.parse(message.data);
  waiting.get(reply.id)?.(reply);
  waiting.delete(reply.id);
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++nextId;
    waiting.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Runs code in the page and returns its result; stops everything when it throws. */
async function evaluate(expression) {
  const { result } = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    console.error(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text,
    );
    process.exit(1);
  }
  return result.result.value;
}

/** Opens a path in the app and waits until it has drawn (the lazy screens load first). */
async function open(path) {
  await send("Page.navigate", { url: app + path });
  for (let i = 0; i < 50; i++) {
    await sleep(200);
    if (await evaluate(`!!document.querySelector('main h1, main h2')`)) break;
  }
  await sleep(1500); // drawings, charts and their animations
}

await send("Emulation.setDeviceMetricsOverride", {
  width: 360,
  height: 640,
  deviceScaleFactor: 3,
  mobile: true,
});
await send("Page.navigate", { url: app + "/setup" });
await sleep(2000);
const lastWorkout = await evaluate(SEED);

for (const [name, path, action] of SHOTS) {
  await open(path.replace("{lastWorkout}", lastWorkout));
  if (action) {
    await evaluate(`(async () => { ${HELPERS}; ${action} })()`);
    await sleep(1000);
  }
  const { result } = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(`${outDir}/${name}.png`, Buffer.from(result.data, "base64"));
  console.log(`  ${name}.png`);
}
ws.close();
process.exit(0);
