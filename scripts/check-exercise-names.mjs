// Checks exercise names against the app's naming standards, and suggests a fix:
//   node scripts/check-exercise-names.mjs              the app's library (frontend/public/exercises)
//   node scripts/check-exercise-names.mjs names.json   a JSON list of names (or of {name} objects,
//                                                      or id → name, like exercise-extra.json),
//                                                      e.g. exercises you're about to add
// It also runs as a git hook when scripts/exercise-extra.json changes (.pre-commit-config.yaml),
// and the library build checks every name (build-exercises.mjs).
// Exits with 1 when a name breaks a rule (errors), 0 when there are only warnings.
//
// The standards (one name per exercise, the same words for the same thing):
//   1. Title Case, also after a hyphen (Push-Up, Close-Grip); small words lowercase (with, on,
//      Low-to-High).
//   2. Singular: Squat, not Squats. A few names are plural by nature (High Knees, Battle Ropes).
//   3. One spelling per word: Single-Arm / Single-Leg (not One-Arm, One Arm, Single Arm), Fly
//      (not Flye), Tricep and Bicep, Push-Up / Pull-Up / Chin-Up / Sit-Up / Step-Up, hyphens in
//      Close-Grip, Wide-Grip, Bent-Over, Straight-Arm, EZ-Bar; Skull Crusher; Machine, not
//      Leverage.
//   4. Equipment goes in front: Dumbbell Squat, Banded Squat; not "Squat with Dumbbells". And
//      Single-Arm / Single-Leg before that: Single-Arm Dumbbell Row.
//   5. Just the name: no " - " subtitles, (brackets), plurals with 's (180's), double spaces
//      or & signs. A possessive is fine (Child's Pose).
//   6. Unique: no two exercises with the same name (ignoring case).
//   7. Short enough to fit a list row: warning above MAX_LENGTH characters.
import { readFileSync } from "node:fs";

const MAX_LENGTH = 32;
const SMALL_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "for",
  "from",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);
// Plural by nature: a movement done over and over, not one of many exercises.
const PLURAL_NAMES = new Set([
  "arm circles",
  "battle ropes",
  "high knees",
  "leg swings",
  "torso twists",
]);
// Last words that are an exercise in the plural → singular.
const SINGULAR = {
  squats: "Squat",
  curls: "Curl",
  rows: "Row",
  raises: "Raise",
  lunges: "Lunge",
  flyes: "Fly",
  flys: "Fly",
  flies: "Fly",
  presses: "Press",
  pulldowns: "Pulldown",
  pushdowns: "Pushdown",
  extensions: "Extension",
  deadlifts: "Deadlift",
  crunches: "Crunch",
  dips: "Dip",
  shrugs: "Shrug",
  jumps: "Jump",
  swings: "Swing",
  pullups: "Pull-Up",
  pushups: "Push-Up",
  chinups: "Chin-Up",
  situps: "Sit-Up",
  "step-ups": "Step-Up",
  "sit-ups": "Sit-Up",
  "push-ups": "Push-Up",
  "pull-ups": "Pull-Up",
  "chin-ups": "Chin-Up",
  stones: "Stone",
  kicks: "Kick",
  hops: "Hop",
  rollouts: "Rollout",
  laterals: "Lateral Raise",
  mornings: "Morning",
  thrusts: "Thrust",
  bridges: "Bridge",
  carries: "Carry",
  walks: "Walk",
  twists: "Twist",
  pulls: "Pull",
  cleans: "Clean",
  snatches: "Snatch",
  jerks: "Jerk",
  slams: "Slam",
};
// One spelling per word: [pattern, replacement, what's wrong].
const SPELLINGS = [
  [
    /\b(One|Single)[- ]Arm\b/gi,
    "Single-Arm",
    "Single-Arm, not One-Arm / Single Arm",
  ],
  [
    /\b(One|Single)[- ]Leg(ged)?\b/gi,
    "Single-Leg",
    "Single-Leg, not One-Leg / Single Leg",
  ],
  [/\bFlyes?\b/gi, "Fly", "Fly, not Flye"],
  [/\bTriceps\b/gi, "Tricep", "Tricep, not Triceps"],
  [/\bBiceps\b/gi, "Bicep", "Bicep, not Biceps"],
  [
    /\b(Push|Pull|Chin|Sit|Step)[- ]?ups?\b/gi,
    (_, w) => `${cap(w)}-Up`,
    "Push-Up, Pull-Up, Chin-Up, Sit-Up, Step-Up (hyphen, capital U)",
  ],
  [
    /\b(Close|Wide|Neutral|Mixed|Reverse)[ ]Grip\b/gi,
    (_, w) => `${cap(w)}-Grip`,
    "hyphen in Close-Grip, Wide-Grip",
  ],
  [/\bBent[ ]Over\b/gi, "Bent-Over", "hyphen in Bent-Over"],
  [/\bStraight[ ]Arm\b/gi, "Straight-Arm", "hyphen in Straight-Arm"],
  [/\bE-?Z[ -]?(Curl )?Bar\b/gi, "EZ-Bar", "EZ-Bar"],
  [/\bLeverage\b/g, "Machine", "Machine, not Leverage"],
  [/\bDB\b/g, "Dumbbell", "Dumbbell, not DB"],
  [/\bSkullcrushers?\b/gi, "Skull Crusher", "Skull Crusher, not Skullcrusher"],
];
// "… with Dumbbells" → "Dumbbell …"
const EQUIPMENT_AFTER =
  /\s+(?:-\s*)?with\s+(dumbbells?|barbells?|bands?|kettlebells?|cables?)$/i;
const EQUIPMENT_PREFIX = {
  dumbbell: "Dumbbell",
  barbell: "Barbell",
  band: "Banded",
  kettlebell: "Kettlebell",
  cable: "Cable",
};

const cap = (word) =>
  word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

/** The name in Title Case: every word (and every part after a hyphen) capitalised. */
function titleCase(name) {
  return name
    .split(" ")
    .map((word, i) => {
      if (i > 0 && SMALL_WORDS.has(word.toLowerCase()))
        return word.toLowerCase();
      return word
        .split("-")
        .map((part, j) =>
          /^[A-Z0-9]{2,}$/.test(part)
            ? part
            : j > 0 && SMALL_WORDS.has(part.toLowerCase())
              ? part.toLowerCase() // Low-to-High
              : part.charAt(0).toUpperCase() + part.slice(1),
        )
        .join("-");
    })
    .join(" ");
}

/** The rules a name breaks, and the name as it should be (when that can be worked out). */
export function checkName(name) {
  const problems = [];
  let fixed = name.trim().replace(/\s+/g, " ");
  if (fixed !== name) problems.push("extra spaces");

  // (A possessive is fine: Child's Pose. A plural with 's isn't: 180's.)
  if (/ - |[()&]|[0-9A-Z]'s\b/.test(fixed))
    problems.push("just the name: no ' - ', (brackets), 's or &");

  const after = fixed.match(EQUIPMENT_AFTER);
  if (after) {
    const kind = after[1].toLowerCase().replace(/s$/, "");
    fixed = `${EQUIPMENT_PREFIX[kind]} ${fixed.slice(0, after.index)}`;
    problems.push(
      "equipment in front (Dumbbell Squat, not Squat with Dumbbells)",
    );
  }

  for (const [pattern, replacement, rule] of SPELLINGS) {
    const next = fixed.replace(pattern, replacement);
    if (next !== fixed) problems.push(rule);
    fixed = next;
  }

  // Single-Arm / Single-Leg first: Single-Arm Dumbbell Row, not Dumbbell Single-Arm Row
  const side = fixed.match(/ (Single-(?:Arm|Leg))\b/);
  if (side) {
    fixed = `${side[1]} ${fixed.replace(side[0], "")}`;
    problems.push("Single-Arm / Single-Leg first");
  }

  const words = fixed.split(" ");
  const last = words.at(-1).toLowerCase();
  if (!PLURAL_NAMES.has(fixed.toLowerCase()) && SINGULAR[last]) {
    words[words.length - 1] = SINGULAR[last];
    fixed = words.join(" ");
    problems.push("singular (Squat, not Squats)");
  }

  const cased = titleCase(fixed);
  if (cased !== fixed)
    problems.push("Title Case, also after a hyphen (Push-Up)");
  fixed = cased;

  return { problems, fixed: fixed === name ? null : fixed };
}

// --- Run it --------------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const file =
    process.argv[2] ??
    new URL("../frontend/public/exercises/exercises.json", import.meta.url)
      .pathname;
  // A list of names or of {name} objects, or an object of id → name (exercise-extra.json).
  const data = JSON.parse(readFileSync(file, "utf8"));
  const names = Array.isArray(data)
    ? data.map((e) => (typeof e === "string" ? e : e.name))
    : Object.values(data);

  let errors = 0;
  let warnings = 0;
  const seen = new Map();
  for (const name of names) {
    const { problems, fixed } = checkName(name);
    const key = (fixed ?? name).toLowerCase();
    if (seen.has(key)) problems.push(`same name as "${seen.get(key)}"`);
    else seen.set(key, name);
    if (problems.length > 0) {
      errors++;
      console.log(
        `✗ ${name}${fixed ? `  →  ${fixed}` : ""}\n    ${problems.join("; ")}`,
      );
    }
    if ((fixed ?? name).length > MAX_LENGTH) {
      warnings++;
      console.log(
        `! ${fixed ?? name}: ${(fixed ?? name).length} characters (over ${MAX_LENGTH}, may not fit a list row)`,
      );
    }
  }
  console.log(`\n${names.length} names: ${errors} to fix, ${warnings} long`);
  process.exit(errors > 0 ? 1 : 0);
}
