"""Load a parsed legacy sheet (see legacy_sheet.py) into the database for one user.

Re-running the import is safe: workouts are matched on (user, import_key) and their
contents are replaced, so edits made in the sheet show up and nothing is duplicated.
"""

import tomllib
import uuid
from dataclasses import dataclass, field
from pathlib import Path

from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.importers.legacy_sheet import ParseResult
from app.models import (
    Exercise,
    ExerciseMuscle,
    Muscle,
    MuscleRole,
    User,
    Workout,
    WorkoutExercise,
    WorkoutSet,
    WorkoutStatus,
)

DEFAULT_MAPPING_FILE = Path(__file__).with_name("legacy_exercise_map.toml")


class CustomExerciseSpec(BaseModel):
    equipment: str | None = None
    category: str | None = None
    mechanic: str | None = None
    force: str | None = None
    primary_muscles: list[str] = []
    secondary_muscles: list[str] = []


class ExerciseMapping(BaseModel):
    library: dict[str, str] = {}
    custom: dict[str, CustomExerciseSpec] = {}

    @classmethod
    def from_file(cls, path: Path) -> "ExerciseMapping":
        with path.open("rb") as f:
            return cls.model_validate(tomllib.load(f))


class LegacyImportError(Exception):
    """The import can't proceed. The caller should roll back the session."""


@dataclass
class ImportStats:
    user_created: bool = False
    workouts_created: int = 0
    workouts_updated: int = 0
    sets: int = 0
    # legacy name → name of the exercise it was mapped to (custom ones are marked)
    exercise_map: dict[str, str] = field(default_factory=dict)


async def get_or_create_user(session: AsyncSession, email: str) -> tuple[User, bool]:
    email = email.strip().lower()
    user = await session.scalar(select(User).where(User.email == email))
    if user is not None:
        return user, False
    user = User(email=email)
    session.add(user)
    await session.flush()
    return user, True


async def _create_custom_exercise(
    session: AsyncSession, user: User, name: str, spec: CustomExerciseSpec
) -> Exercise:
    wanted = set(spec.primary_muscles) | set(spec.secondary_muscles)
    muscles = {
        m.name: m for m in await session.scalars(select(Muscle).where(Muscle.name.in_(wanted)))
    }
    if unknown := wanted - muscles.keys():
        raise LegacyImportError(f"custom exercise {name!r}: unknown muscle(s) {sorted(unknown)}")

    exercise = Exercise(
        slug=f"custom-{uuid.uuid4().hex[:12]}",
        name=name,
        owner_id=user.id,
        equipment=spec.equipment,
        category=spec.category,
        mechanic=spec.mechanic,
        force=spec.force,
        muscles=[
            ExerciseMuscle(muscle=muscles[m], role=MuscleRole.PRIMARY) for m in spec.primary_muscles
        ]
        + [
            ExerciseMuscle(muscle=muscles[m], role=MuscleRole.SECONDARY)
            for m in spec.secondary_muscles
            if m not in spec.primary_muscles
        ],
    )
    session.add(exercise)
    await session.flush()
    return exercise


async def resolve_exercises(
    session: AsyncSession, user: User, names: set[str], mapping: ExerciseMapping
) -> dict[str, Exercise]:
    """Map each legacy exercise name to an Exercise, creating custom ones as configured."""
    resolved: dict[str, Exercise] = {}
    problems: list[str] = []

    for name in sorted(names):
        if slug := mapping.library.get(name):
            exercise = await session.scalar(
                select(Exercise).where(Exercise.slug == slug, Exercise.owner_id.is_(None))
            )
            if exercise is None:
                problems.append(f"{name!r} → library id {slug!r} doesn't exist")
                continue
        elif existing := await session.scalar(
            select(Exercise).where(
                Exercise.owner_id == user.id, func.lower(Exercise.name) == name.lower()
            )
        ):
            exercise = existing
        elif spec := mapping.custom.get(name):
            exercise = await _create_custom_exercise(session, user, name, spec)
        else:
            matches = (
                await session.scalars(
                    select(Exercise).where(
                        Exercise.owner_id.is_(None), func.lower(Exercise.name) == name.lower()
                    )
                )
            ).all()
            if len(matches) != 1:
                problems.append(f"{name!r} isn't mapped (add it to the mapping file)")
                continue
            exercise = matches[0]
        resolved[name] = exercise

    if problems:
        raise LegacyImportError("can't map all exercises:\n  " + "\n  ".join(problems))
    return resolved


async def import_legacy(
    session: AsyncSession, email: str, parsed: ParseResult, mapping: ExerciseMapping
) -> ImportStats:
    """Write the parsed workouts for the user with this email. The caller commits."""
    user, user_created = await get_or_create_user(session, email)
    exercises = await resolve_exercises(session, user, parsed.exercise_names, mapping)
    stats = ImportStats(
        user_created=user_created,
        exercise_map={
            legacy: ex.name + (" (custom)" if ex.is_custom else "")
            for legacy, ex in exercises.items()
        },
    )

    keys = [w.import_key for w in parsed.workouts]
    existing = {
        w.import_key: w
        for w in await session.scalars(
            select(Workout).where(Workout.user_id == user.id, Workout.import_key.in_(keys))
        )
    }
    if existing:
        # Replace the contents of previously imported workouts (sets cascade in the DB).
        await session.execute(
            delete(WorkoutExercise).where(
                WorkoutExercise.workout_id.in_([w.id for w in existing.values()])
            )
        )

    for parsed_workout in parsed.workouts:
        workout = existing.get(parsed_workout.import_key)
        if workout is None:
            workout = Workout(user_id=user.id, import_key=parsed_workout.import_key)
            session.add(workout)
            stats.workouts_created += 1
        else:
            stats.workouts_updated += 1
        workout.name = parsed_workout.name
        workout.performed_on = parsed_workout.performed_on
        workout.status = WorkoutStatus.COMPLETED
        workout.notes = "\n".join(parsed_workout.notes) or None
        await session.flush()  # assigns workout.id for new workouts

        for position, parsed_exercise in enumerate(parsed_workout.exercises, start=1):
            session.add(
                WorkoutExercise(
                    workout_id=workout.id,
                    exercise_id=exercises[parsed_exercise.name].id,
                    position=position,
                    sets=[
                        WorkoutSet(
                            position=s.position,
                            weight_kg=s.weight_kg,
                            reps=s.reps,
                            notes=s.notes,
                        )
                        for s in parsed_exercise.sets
                    ],
                )
            )
            stats.sets += len(parsed_exercise.sets)

    await session.flush()
    return stats
