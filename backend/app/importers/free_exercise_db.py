"""The exercise library: https://github.com/yuhonas/free-exercise-db (public domain, Unlicense).

`download()` fetches a pinned commit's tarball and keeps only the JSON + images.
`seed_library()` upserts muscles and exercises into the database; it's safe to re-run.
"""

import json
import re
import shutil
import tarfile
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Exercise, ExerciseMuscle, Muscle, MuscleRole

REPO = "yuhonas/free-exercise-db"
# Pinned so every environment seeds the same data. Bump deliberately.
COMMIT = "a859101d633a01c4a1a920d6a8ce41dabba0705f"
TARBALL_URL = f"https://codeload.github.com/{REPO}/tar.gz/{COMMIT}"

JSON_FILE = "exercises.json"
IMAGES_DIR = "images"
VERSION_FILE = "VERSION"

# Image paths look like "3_4_Sit-Up/0.jpg"; anything else in the tarball is ignored.
_IMAGE_RE = re.compile(r"^exercises/([A-Za-z0-9_\-]+)/(\d+\.jpg)$")


class FreeExercise(BaseModel):
    """One record of exercises.json."""

    id: str
    name: str
    force: str | None = None
    level: str | None = None
    mechanic: str | None = None
    equipment: str | None = None
    category: str | None = None
    primary_muscles: list[str] = Field(alias="primaryMuscles")
    secondary_muscles: list[str] = Field(alias="secondaryMuscles")
    instructions: list[str] = []
    images: list[str] = []


def dataset_dir(data_dir: Path) -> Path:
    return data_dir / "free-exercise-db"


def is_downloaded(data_dir: Path) -> bool:
    version_file = dataset_dir(data_dir) / VERSION_FILE
    return version_file.exists() and version_file.read_text().strip() == COMMIT


def download(data_dir: Path) -> Path:
    """Download the pinned dataset into data_dir, replacing any previous version."""
    target = dataset_dir(data_dir)

    tmp = target.with_name(target.name + ".tmp")
    shutil.rmtree(tmp, ignore_errors=True)
    (tmp / IMAGES_DIR).mkdir(parents=True)

    # "r|gz" streams the archive, so it's never fully held in memory or on disk.
    with (
        urllib.request.urlopen(TARBALL_URL, timeout=60) as resp,
        tarfile.open(fileobj=resp, mode="r|gz") as tar,
    ):
        for member in tar:
            if not member.isfile():
                continue
            # Strip the "free-exercise-db-<sha>/" top-level folder.
            path = member.name.split("/", 1)[1] if "/" in member.name else ""
            if path == f"dist/{JSON_FILE}":
                dest = tmp / JSON_FILE
            elif m := _IMAGE_RE.match(path):
                # We build the destination ourselves from validated parts, so a
                # malicious archive can't write outside the target directory.
                dest = tmp / IMAGES_DIR / m.group(1) / m.group(2)
            else:
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            src = tar.extractfile(member)
            assert src is not None
            with src, dest.open("wb") as out:
                shutil.copyfileobj(src, out)

    if not (tmp / JSON_FILE).exists():
        raise RuntimeError(f"{JSON_FILE} not found in {TARBALL_URL}")
    (tmp / VERSION_FILE).write_text(COMMIT + "\n")

    # Swap in the new version only once it's complete.
    shutil.rmtree(target, ignore_errors=True)
    tmp.rename(target)
    return target


def load_json(data_dir: Path) -> list[FreeExercise]:
    raw = json.loads((dataset_dir(data_dir) / JSON_FILE).read_text())
    return [FreeExercise.model_validate(item) for item in raw]


@dataclass
class SeedStats:
    muscles: int
    exercises: int
    exercise_muscles: int


async def seed_library(session: AsyncSession, exercises: list[FreeExercise]) -> SeedStats:
    """Upsert the library into the database. Idempotent; the caller commits."""
    if not exercises:
        raise ValueError("no exercises to seed")
    # 1. Muscles
    muscle_names = sorted(
        {m for ex in exercises for m in ex.primary_muscles + ex.secondary_muscles}
    )
    if muscle_names:
        await session.execute(
            insert(Muscle).values([{"name": n} for n in muscle_names]).on_conflict_do_nothing()
        )
    muscle_ids = dict((await session.execute(select(Muscle.name, Muscle.id))).tuples().all())

    # 2. Exercises, matched on slug (= the dataset id)
    rows = [
        {
            "slug": ex.id,
            "name": ex.name,
            "force": ex.force,
            "level": ex.level,
            "mechanic": ex.mechanic,
            "equipment": ex.equipment,
            "category": ex.category,
            "instructions": ex.instructions,
            "image_paths": ex.images,
        }
        for ex in exercises
    ]
    stmt = insert(Exercise).values(rows)
    upsert = stmt.on_conflict_do_update(
        index_elements=[Exercise.slug],
        # ORM onupdate hooks don't run for ON CONFLICT, so bump updated_at explicitly.
        set_={col: stmt.excluded[col] for col in rows[0] if col != "slug"}
        | {"updated_at": func.now()},
    ).returning(Exercise.slug, Exercise.id)
    exercise_ids = dict((await session.execute(upsert)).tuples().all())

    # 3. Exercise ↔ muscle links: replace them wholesale for the library exercises.
    await session.execute(
        delete(ExerciseMuscle).where(ExerciseMuscle.exercise_id.in_(exercise_ids.values()))
    )
    links: dict[tuple[int, int], MuscleRole] = {}
    for ex in exercises:
        for name in ex.secondary_muscles:
            links[(exercise_ids[ex.id], muscle_ids[name])] = MuscleRole.SECONDARY
        for name in ex.primary_muscles:  # primary wins if a muscle is listed twice
            links[(exercise_ids[ex.id], muscle_ids[name])] = MuscleRole.PRIMARY
    if links:
        await session.execute(
            insert(ExerciseMuscle).values(
                [{"exercise_id": e, "muscle_id": m, "role": r} for (e, m), r in links.items()]
            )
        )

    return SeedStats(
        muscles=len(muscle_ids), exercises=len(exercise_ids), exercise_muscles=len(links)
    )
