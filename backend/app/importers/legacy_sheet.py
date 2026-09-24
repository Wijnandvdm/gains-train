"""Parser for the legacy Google Sheets workout log ("gainz - Log.csv").

Expected columns: Date, Day, Exercise, Set, Weight (kg), Reps, Muscle Group, Notes,
plus an optional unnamed trailing column that holds free-form workout notes.

The sheet has one row per set and no explicit workout boundaries, so rows are grouped:
consecutive rows with the same Day code belong to one workout, as long as the date doesn't
jump by more than a day (sessions regularly run past midnight). Missing dates are filled
from the row above. This module only parses; loading into the database is separate.
"""

import csv
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import cast

REQUIRED_COLUMNS = ("Date", "Day", "Exercise", "Weight (kg)", "Reps")
IMPORT_KEY_PREFIX = "legacy-sheet"


class LegacySheetError(ValueError):
    """The file can't be parsed as a legacy log at all."""


@dataclass
class ParsedSet:
    position: int
    weight_kg: Decimal | None
    reps: int | None
    notes: str | None = None


@dataclass
class ParsedExercise:
    name: str
    sets: list[ParsedSet] = field(default_factory=list)


@dataclass
class ParsedWorkout:
    import_key: str
    performed_on: date
    day_code: str
    name: str
    notes: list[str] = field(default_factory=list)
    exercises: list[ParsedExercise] = field(default_factory=list)
    last_date: date | None = None

    def exercise(self, name: str) -> ParsedExercise:
        for ex in self.exercises:
            if ex.name == name:
                return ex
        ex = ParsedExercise(name=name)
        self.exercises.append(ex)
        return ex


@dataclass
class ParseResult:
    workouts: list[ParsedWorkout]
    warnings: list[str]

    @property
    def exercise_names(self) -> set[str]:
        return {ex.name for w in self.workouts for ex in w.exercises}

    @property
    def set_count(self) -> int:
        return sum(len(ex.sets) for w in self.workouts for ex in w.exercises)


def _parse_decimal(raw: str) -> Decimal | None:
    raw = raw.strip().replace(",", ".")
    if not raw:
        return None
    try:
        value = Decimal(raw)
    except InvalidOperation:
        raise ValueError(f"not a number: {raw!r}") from None
    if value < 0:
        raise ValueError(f"negative value: {raw!r}")
    return value


def _parse_int(raw: str) -> int | None:
    value = _parse_decimal(raw)
    if value is None:
        return None
    if value != value.to_integral_value():
        raise ValueError(f"not a whole number: {raw!r}")
    return int(value)


def parse_legacy_log(lines: Iterable[str]) -> ParseResult:
    """Parse the legacy log CSV. `lines` is any iterable of text lines (e.g. an open file)."""
    # Values beyond the header's columns are collected under "_extra".
    reader = csv.DictReader(lines, restkey="_extra")
    header = [h.strip() for h in (reader.fieldnames or [])]
    missing = [c for c in REQUIRED_COLUMNS if c not in header]
    if missing:
        raise LegacySheetError(f"missing column(s): {', '.join(missing)}")

    workouts: list[ParsedWorkout] = []
    warnings: list[str] = []
    current: ParsedWorkout | None = None
    last_date: date | None = None

    # Line 1 is the header, so data starts at line 2.
    for line_no, raw_row in enumerate(reader, start=2):
        overflow = cast(list[str], raw_row.pop("_extra", None) or [])
        row = {k.strip(): (v or "").strip() for k, v in raw_row.items()}
        # The unnamed column (and anything beyond the header) holds workout-level notes.
        extra = [v.strip() for v in [row.get("", ""), *overflow] if v.strip()]

        if not any(row.get(c) for c in REQUIRED_COLUMNS):
            continue  # blank row

        exercise_name = row["Exercise"]
        day_code = row["Day"]
        if not exercise_name or not day_code:
            warnings.append(f"line {line_no}: skipped, missing exercise or day")
            continue

        if row["Date"]:
            try:
                row_date = date.fromisoformat(row["Date"])
            except ValueError:
                warnings.append(f"line {line_no}: skipped, invalid date {row['Date']!r}")
                continue
        elif last_date is not None:
            row_date = last_date
            warnings.append(f"line {line_no}: missing date, used {row_date} from the row above")
        else:
            warnings.append(f"line {line_no}: skipped, missing date and no earlier row")
            continue

        try:
            weight = _parse_decimal(row["Weight (kg)"])
            reps = _parse_int(row["Reps"])
        except ValueError as e:
            warnings.append(f"line {line_no}: skipped, {e}")
            continue
        if weight is None:
            warnings.append(f"line {line_no}: {exercise_name} has no weight, imported without it")
        if reps is None:
            warnings.append(f"line {line_no}: {exercise_name} has no reps, imported without them")

        starts_new_workout = (
            current is None
            or current.day_code != day_code
            or current.last_date is None
            or (row_date - current.last_date).days > 1
            or row_date < current.last_date
        )
        if starts_new_workout:
            muscle_group = row.get("Muscle Group", "")
            current = ParsedWorkout(
                import_key=f"{IMPORT_KEY_PREFIX}:{row_date.isoformat()}:{day_code}",
                performed_on=row_date,
                day_code=day_code,
                name=f"{day_code} · {muscle_group}" if muscle_group else day_code,
            )
            workouts.append(current)
        assert current is not None
        current.last_date = row_date
        current.notes.extend(extra)

        ex = current.exercise(exercise_name)
        ex.sets.append(
            ParsedSet(
                position=len(ex.sets) + 1,
                weight_kg=weight,
                reps=reps,
                notes=row.get("Notes") or None,
            )
        )
        last_date = row_date

    _dedupe_import_keys(workouts)
    return ParseResult(workouts=workouts, warnings=warnings)


def _dedupe_import_keys(workouts: list[ParsedWorkout]) -> None:
    """Two separate workouts with the same date + day code get a numeric suffix."""
    seen: dict[str, int] = {}
    for w in workouts:
        n = seen.get(w.import_key, 0) + 1
        seen[w.import_key] = n
        if n > 1:
            w.import_key = f"{w.import_key}:{n}"
