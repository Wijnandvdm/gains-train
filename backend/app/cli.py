"""Admin commands. Run from backend/:

uv run python -m app.cli seed-exercises
uv run python -m app.cli import-legacy --email you@example.com "path/to/gainz - Log.csv"
"""

import argparse
import asyncio
import sys
from pathlib import Path

from app.config import settings
from app.db import SessionLocal, engine
from app.importers import free_exercise_db
from app.importers.legacy_loader import (
    DEFAULT_MAPPING_FILE,
    ExerciseMapping,
    LegacyImportError,
    import_legacy,
)
from app.importers.legacy_sheet import LegacySheetError, parse_legacy_log


async def seed_exercises(args: argparse.Namespace) -> int:
    version = f"{free_exercise_db.REPO}@{free_exercise_db.COMMIT[:7]}"
    if args.force or not free_exercise_db.is_downloaded(settings.data_dir):
        print(f"Downloading {version} (~100 MB, mostly images) …")
        await asyncio.to_thread(free_exercise_db.download, settings.data_dir)
    else:
        print(f"Using already downloaded {version}")
    exercises = free_exercise_db.load_json(settings.data_dir)

    async with SessionLocal() as session:
        stats = await free_exercise_db.seed_library(session, exercises)
        await session.commit()
    print(
        f"Seeded {stats.exercises} exercises, {stats.muscles} muscles, "
        f"{stats.exercise_muscles} exercise-muscle links"
    )
    return 0


async def import_legacy_sheet(args: argparse.Namespace) -> int:
    try:
        with args.csv.open(encoding="utf-8-sig", newline="") as f:
            parsed = parse_legacy_log(f)
    except (OSError, LegacySheetError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    mapping = ExerciseMapping.from_file(args.mapping)

    print(
        f"Parsed {len(parsed.workouts)} workouts, {parsed.set_count} sets, "
        f"{len(parsed.exercise_names)} exercises from {args.csv.name}"
    )
    for warning in parsed.warnings:
        print(f"  warning: {warning}")

    async with SessionLocal() as session:
        try:
            stats = await import_legacy(session, args.email, parsed, mapping)
        except LegacyImportError as e:
            await session.rollback()
            print(f"error: {e}", file=sys.stderr)
            return 1

        print("\nExercise mapping:")
        width = max(map(len, stats.exercise_map))
        for legacy, target in sorted(stats.exercise_map.items()):
            print(f"  {legacy:<{width}}  →  {target}")
        print(
            f"\nUser {args.email}{' (new)' if stats.user_created else ''}: "
            f"{stats.workouts_created} workouts created, {stats.workouts_updated} updated, "
            f"{stats.sets} sets"
        )

        if args.dry_run:
            await session.rollback()
            print("Dry run: nothing was saved.")
        else:
            await session.commit()
            print("Saved.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli", description=__doc__)
    sub = parser.add_subparsers(required=True)

    p = sub.add_parser("seed-exercises", help="download and load the exercise library")
    p.add_argument("--force", action="store_true", help="re-download even if already present")
    p.set_defaults(func=seed_exercises)

    p = sub.add_parser("import-legacy", help="import the legacy Google Sheets log (CSV)")
    p.add_argument("csv", type=Path, help='the exported "Log" tab, e.g. "gainz - Log.csv"')
    p.add_argument("--email", required=True, help="the user to import for (created if new)")
    p.add_argument("--mapping", type=Path, default=DEFAULT_MAPPING_FILE)
    p.add_argument("--dry-run", action="store_true", help="show what would happen, save nothing")
    p.set_defaults(func=import_legacy_sheet)

    args = parser.parse_args()

    async def run() -> int:
        try:
            result: int = await args.func(args)
            return result
        finally:
            await engine.dispose()

    return asyncio.run(run())


if __name__ == "__main__":
    sys.exit(main())
