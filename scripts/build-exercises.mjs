// Builds the app's exercise library (frontend/public/exercises/) from two open datasets:
//
// - Workout Guide (https://github.com/bryllim/workout-guide, drawings CC BY-SA 4.0, based on
//   Everkinetic): the exercises themselves, their names and one uniform line drawing per pose.
// - free-exercise-db (https://github.com/yuhonas/free-exercise-db, Unlicense): instructions and
//   detailed muscles, for the drawn exercises that exist there too (scripts/exercise-map.json,
//   reviewed by hand). Those keep their free-exercise-db id, so logged workouts stay linked.
//
// Output: exercises.json (the app's library: the drawn exercises, plus the undrawn ones picked
// in exercise-extra.json), retired.json (the other free-exercise-db exercises, so the app can
// keep ones you logged as custom exercises), and the drawings as <id>/0.svg (start pose) and
// <id>/1.svg (end pose). Every name meets the naming standards (check-exercise-names.mjs).
//
// Exercises that have no instructions in free-exercise-db get the hand-written ones in
// exercise-instructions.json (next to this script).
//
// Usage: node build-exercises.mjs <free-exercise-db exercises.json> <workout-guide package dir>
//                                 <exercise-map.json> <output dir>
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkName } from "./check-exercise-names.mjs";

const [fedFile, wgDir, mapFile, out] = process.argv.slice(2);
const read = (file) => JSON.parse(readFileSync(file, "utf8"));
const fed = new Map(read(fedFile).map((e) => [e.id, e]));
const guide = read(join(wgDir, "manifest.json"));
const map = read(mapFile);
// Hand-written how-to steps (by exercise id) for exercises free-exercise-db doesn't cover.
const ownInstructions = read(
  new URL("./exercise-instructions.json", import.meta.url),
);
// free-exercise-db exercises without a drawing that the library has too (by id → their name,
// tidied up to the naming standards). The app shows their muscles in place of a drawing.
const extra = read(new URL("./exercise-extra.json", import.meta.url));

/** A name that meets the standards (scripts/check-exercise-names.mjs): Workout Guide's names
 *  get the fixes (Push-up → Push-Up); the names in exercise-extra.json must already pass. */
function standardName(name, fix) {
  const { problems, fixed } = checkName(name);
  if (fixed && fix) return standardName(fixed, false);
  if (problems.length > 0)
    throw new Error(
      `"${name}" breaks the naming standards: ${problems.join("; ")}${fixed ? ` (→ ${fixed})` : ""}`,
    );
  return name;
}

// Workout Guide's muscle groups → the library's muscles (what the muscle map can show).
const MUSCLES = {
  Core: ["abdominals"],
  Glutes: ["glutes"],
  Quads: ["quadriceps"],
  Legs: ["quadriceps"],
  Chest: ["chest"],
  Shoulders: ["shoulders"],
  "Rear Delts": ["shoulders"],
  Back: ["middle back"],
  "Upper Back": ["middle back", "traps"],
  Lats: ["lats"],
  "Lower Back": ["lower back"],
  "Posterior Chain": ["hamstrings", "glutes"],
  Triceps: ["triceps"],
  Biceps: ["biceps"],
  Forearms: ["forearms"],
  Grip: ["forearms"],
  Hamstrings: ["hamstrings"],
  Calves: ["calves"],
  Adductors: ["adductors"],
  Groin: ["adductors"],
  Hips: ["abductors"],
  Mobility: [],
  Cardio: [],
};
const EQUIPMENT = {
  Bodyweight: "body only",
  "Pull-up Bar": "body only",
  Dumbbell: "dumbbell",
  Barbell: "barbell",
  Machine: "machine",
  Cable: "cable",
  "Resistance Band": "bands",
  Kettlebell: "kettlebells",
  "Stability Ball": "exercise ball",
};
const muscles = (groups) => [
  ...new Set(groups.flatMap((g) => MUSCLES[g] ?? [])),
];

mkdirSync(out, { recursive: true });
const library = [];
const used = new Set();
for (const ex of guide) {
  if (!(ex.slug in map))
    throw new Error(`${ex.slug} is missing from exercise-map.json`);
  const match = map[ex.slug] ? fed.get(map[ex.slug]) : undefined;
  if (map[ex.slug] && !match)
    throw new Error(`${ex.slug}: no free-exercise-db exercise ${map[ex.slug]}`);
  const id = match?.id ?? ex.slug;
  used.add(id);

  // Start and end pose (the middle frames are drawn with heavier lines in places).
  const frames = [ex.frames[0], ex.frames.at(-1)];
  mkdirSync(join(out, id), { recursive: true });
  frames.forEach((frame, i) =>
    copyFileSync(join(wgDir, frame.path), join(out, id, `${i}.svg`)),
  );

  const primary = match?.primaryMuscles ?? muscles([ex.primaryMuscle]);
  library.push({
    id,
    name: standardName(ex.name, true),
    force: match?.force ?? null,
    level: match?.level ?? null,
    mechanic: match?.mechanic ?? null,
    equipment: EQUIPMENT[ex.equipment] ?? match?.equipment ?? "other",
    category: ex.isStretch
      ? "stretching"
      : ex.equipment === "Cardio"
        ? "cardio"
        : (match?.category ?? "strength"),
    primaryMuscles: primary,
    secondaryMuscles: (
      match?.secondaryMuscles ?? muscles(ex.secondaryMuscles)
    ).filter((m) => !primary.includes(m)),
    instructions: match?.instructions?.length
      ? match.instructions
      : (ownInstructions[id] ?? []),
    images: frames.map((_, i) => `${id}/${i}.svg`),
  });
}

for (const [id, name] of Object.entries(extra)) {
  const match = fed.get(id);
  if (!match)
    throw new Error(`exercise-extra.json: no free-exercise-db exercise ${id}`);
  if (used.has(id))
    throw new Error(`exercise-extra.json: ${id} is in the library already`);
  used.add(id);
  library.push({ ...match, name: standardName(name, false), images: [] });
}

const names = new Map();
for (const e of library) {
  const key = e.name.toLowerCase();
  if (names.has(key))
    throw new Error(
      `Two exercises named "${e.name}": ${names.get(key)} and ${e.id}`,
    );
  names.set(key, e.id);
}

const retired = [...fed.values()]
  .filter((e) => !used.has(e.id))
  .map((e) => ({ ...e, images: [] }));

library.sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(join(out, "exercises.json"), JSON.stringify(library));
writeFileSync(join(out, "retired.json"), JSON.stringify(retired));
for (const file of ["ATTRIBUTION.md", "LICENSE-ASSETS"])
  copyFileSync(join(wgDir, file), join(out, file));
console.log(
  `${library.length} exercises (${library.filter((e) => e.images.length).length} drawn, ${library.filter((e) => e.instructions.length).length} with instructions), ${retired.length} retired`,
);
