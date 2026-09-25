"""Progress statistics and personal records, as pure functions over performed sets.

Definitions (the frontend's PR badges in src/workout/prs.ts mirror these):
- Estimated 1RM (Epley): weight × (1 + reps / 30); a single rep is just the weight.
- Heaviest weight: the most weight moved for at least one rep.
- Rep record at a weight: the most reps done at that weight. Only records that aren't
  beaten by a heavier weight with as many reps are kept ("85 kg × 12" makes a
  "80 kg × 10" record meaningless).
Ties go to the earliest date: a record is dated when it was first achieved.
"""

import uuid
from collections import defaultdict
from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass
from datetime import date
from decimal import Decimal


@dataclass(frozen=True)
class PerformedSet:
    exercise_id: int
    workout_id: uuid.UUID
    performed_on: date
    weight_kg: Decimal
    reps: int


def e1rm(weight_kg: Decimal, reps: int) -> Decimal | None:
    """Estimated one-rep max (Epley). None for zero reps."""
    if reps < 1:
        return None
    if reps == 1:
        return weight_kg
    return weight_kg * (1 + Decimal(reps) / 30)


def volume(sets: Iterable[PerformedSet]) -> Decimal:
    return sum((s.weight_kg * s.reps for s in sets), Decimal(0))


@dataclass(frozen=True)
class Session:
    """One workout's performance on one exercise (a point on the progress chart)."""

    workout_id: uuid.UUID
    performed_on: date
    top_weight_kg: Decimal
    top_weight_reps: int  # most reps done at the top weight
    best_e1rm_kg: Decimal
    volume_kg: Decimal
    set_count: int


def sessions(sets: Iterable[PerformedSet]) -> list[Session]:
    """Per-workout summaries, oldest first."""
    by_workout: dict[uuid.UUID, list[PerformedSet]] = defaultdict(list)
    for s in sets:
        by_workout[s.workout_id].append(s)

    result = []
    for workout_id, group in by_workout.items():
        with_reps = [s for s in group if s.reps >= 1]
        if not with_reps:
            continue
        top = max(with_reps, key=lambda s: (s.weight_kg, s.reps))
        result.append(
            Session(
                workout_id=workout_id,
                performed_on=group[0].performed_on,
                top_weight_kg=top.weight_kg,
                top_weight_reps=top.reps,
                best_e1rm_kg=max(e1rm(s.weight_kg, s.reps) or Decimal(0) for s in with_reps),
                volume_kg=volume(group),
                set_count=len(group),
            )
        )
    return sorted(result, key=lambda s: s.performed_on)


@dataclass(frozen=True)
class SetRecord:
    weight_kg: Decimal
    reps: int
    performed_on: date


@dataclass(frozen=True)
class Records:
    heaviest: SetRecord
    best_e1rm: SetRecord
    best_e1rm_kg: Decimal
    best_session_volume_kg: Decimal
    best_session_volume_on: date
    rep_records: list[SetRecord]  # heaviest first


def _first_best(
    sets: Sequence[PerformedSet], key: Callable[[PerformedSet], tuple[Decimal, ...]]
) -> PerformedSet:
    """The set with the highest key; among ties, the earliest (max() keeps the first)."""
    return max(sorted(sets, key=lambda s: s.performed_on), key=key)


def records(sets: Sequence[PerformedSet]) -> Records | None:
    with_reps = [s for s in sets if s.reps >= 1]
    if not with_reps:
        return None

    heaviest = _first_best(with_reps, key=lambda s: (s.weight_kg, Decimal(s.reps)))
    strongest = _first_best(with_reps, key=lambda s: (e1rm(s.weight_kg, s.reps) or Decimal(0),))
    best_session = max(sessions(with_reps), key=lambda s: s.volume_kg)  # oldest first

    # Most reps at each weight (first time achieved)…
    best_at_weight: dict[Decimal, PerformedSet] = {}
    for s in sorted(with_reps, key=lambda s: s.performed_on):
        current = best_at_weight.get(s.weight_kg)
        if current is None or s.reps > current.reps:
            best_at_weight[s.weight_kg] = s
    # …keeping only those not matched by a heavier weight.
    rep_records: list[SetRecord] = []
    most_reps_heavier = 0
    for weight in sorted(best_at_weight, reverse=True):
        s = best_at_weight[weight]
        if s.reps > most_reps_heavier:
            rep_records.append(SetRecord(s.weight_kg, s.reps, s.performed_on))
            most_reps_heavier = s.reps

    return Records(
        heaviest=SetRecord(heaviest.weight_kg, heaviest.reps, heaviest.performed_on),
        best_e1rm=SetRecord(strongest.weight_kg, strongest.reps, strongest.performed_on),
        best_e1rm_kg=e1rm(strongest.weight_kg, strongest.reps) or Decimal(0),
        best_session_volume_kg=best_session.volume_kg,
        best_session_volume_on=best_session.performed_on,
        rep_records=rep_records,
    )


@dataclass(frozen=True)
class ExerciseOverview:
    """One row of the dashboard (what the legacy sheet's Dashboard tab showed)."""

    exercise_id: int
    sets_logged: int
    last_performed_on: date
    last_top_weight_kg: Decimal  # "weight used last session"
    max_weight_kg: Decimal
    best_e1rm_kg: Decimal
    total_volume_kg: Decimal


def overview(sets: Iterable[PerformedSet]) -> list[ExerciseOverview]:
    """Per exercise, most recently trained first."""
    by_exercise: dict[int, list[PerformedSet]] = defaultdict(list)
    for s in sets:
        by_exercise[s.exercise_id].append(s)

    rows = []
    for exercise_id, group in by_exercise.items():
        exercise_sessions = sessions(group)
        if not exercise_sessions:
            continue
        last = exercise_sessions[-1]
        rows.append(
            ExerciseOverview(
                exercise_id=exercise_id,
                sets_logged=len(group),
                last_performed_on=last.performed_on,
                last_top_weight_kg=last.top_weight_kg,
                max_weight_kg=max(s.top_weight_kg for s in exercise_sessions),
                best_e1rm_kg=max(s.best_e1rm_kg for s in exercise_sessions),
                total_volume_kg=volume(group),
            )
        )
    return sorted(rows, key=lambda r: r.last_performed_on, reverse=True)
