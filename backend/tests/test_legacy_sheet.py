import io
from datetime import date
from decimal import Decimal

import pytest

from app.importers.legacy_sheet import LegacySheetError, ParseResult, parse_legacy_log

HEADER = "Date,Day,Exercise,Set,Weight (kg),Reps,Muscle Group,Notes,\n"


def parse(body: str, header: str = HEADER) -> ParseResult:
    return parse_legacy_log(io.StringIO(header + body))


def test_groups_sets_into_workouts_and_exercises() -> None:
    result = parse(
        "2026-07-19,Day1,Hack Squat,1,60.0,8,Legs,,\n"
        "2026-07-19,Day1,Hack Squat,2,60.0,7,Legs,,\n"
        "2026-07-19,Day1,Leg Curl,1,102.0,12,Legs,,\n"
        "2026-07-22,Day2,Lat Pulldown,1,70.0,14,Back & Triceps,,\n"
    )
    assert [w.import_key for w in result.workouts] == [
        "legacy-sheet:2026-07-19:Day1",
        "legacy-sheet:2026-07-22:Day2",
    ]
    day1 = result.workouts[0]
    assert day1.name == "Day1 · Legs"
    assert [e.name for e in day1.exercises] == ["Hack Squat", "Leg Curl"]
    assert [(s.position, s.weight_kg, s.reps) for s in day1.exercises[0].sets] == [
        (1, Decimal("60.0"), 8),
        (2, Decimal("60.0"), 7),
    ]
    assert result.warnings == []
    assert result.set_count == 4


def test_session_past_midnight_stays_one_workout() -> None:
    result = parse(
        "2026-07-23,Day3,Incline Seated Bicep Curl,2,14.0,12,Chest & Biceps,,\n"
        "2026-07-24,Day3,Incline Seated Bicep Curl,3,14.0,12,Chest & Biceps,,\n"
        "2026-07-24,Day3,Preacher Curl,1,8.8,12,Chest & Biceps,,\n"
    )
    assert len(result.workouts) == 1
    assert result.workouts[0].performed_on == date(2026, 7, 23)
    assert result.set_count == 3


def test_two_split_days_on_the_same_date_are_separate_workouts() -> None:
    result = parse(
        "2026-09-07,Day1,Leg Extension,1,97.0,10,Legs,,\n"
        "2026-09-07,Day2,Lat Pulldown,1,90.0,12,Back & Triceps,,\n"
    )
    assert [w.day_code for w in result.workouts] == ["Day1", "Day2"]


def test_same_day_code_after_a_gap_is_a_new_workout() -> None:
    result = parse(
        "2026-08-01,Day3,Preacher Curl,1,8.8,12,Chest & Biceps,,\n"
        "2026-08-07,Day3,Preacher Curl,1,10.0,12,Chest & Biceps,,\n"
    )
    assert [w.performed_on for w in result.workouts] == [date(2026, 8, 1), date(2026, 8, 7)]


def test_missing_date_is_filled_from_row_above_with_warning() -> None:
    result = parse(
        "2026-09-15,Day2,Lat Pulldown,1,85.0,10,Back & Triceps,,\n"
        ",Day2,Lat Pulldown,2,85.0,9,Back & Triceps,,\n"
    )
    assert len(result.workouts) == 1
    assert result.set_count == 2
    assert result.warnings == ["line 3: missing date, used 2026-09-15 from the row above"]


def test_missing_reps_imports_set_without_reps() -> None:
    result = parse("2026-09-15,Day2,Lat Pulldown,3,85.0,,Back & Triceps,,\n")
    s = result.workouts[0].exercises[0].sets[0]
    assert (s.weight_kg, s.reps) == (Decimal("85.0"), None)
    assert result.warnings == ["line 2: Lat Pulldown has no reps, imported without them"]


def test_notes_column_goes_to_set_and_unnamed_column_to_workout() -> None:
    result = parse(
        "2026-09-07,Day2,Lat Pulldown,2,85.0,8,Back & Triceps,corrected form,\n"
        "2026-09-07,Day2,Lat Pulldown,3,85.0,8,Back & Triceps,,machine died :(\n"
    )
    workout = result.workouts[0]
    assert [s.notes for s in workout.exercises[0].sets] == ["corrected form", None]
    assert workout.notes == ["machine died :("]


def test_invalid_values_skip_the_row_with_warning() -> None:
    result = parse(
        "2026-09-07,Day2,Lat Pulldown,1,heavy,8,Back & Triceps,,\n"
        "2026-09-07,Day2,Lat Pulldown,2,85.0,8.5,Back & Triceps,,\n"
        "not-a-date,Day2,Lat Pulldown,3,85.0,8,Back & Triceps,,\n"
        "2026-09-07,Day2,Lat Pulldown,4,85.0,8,Back & Triceps,,\n"
    )
    assert result.set_count == 1
    assert result.warnings == [
        "line 2: skipped, not a number: 'heavy'",
        "line 3: skipped, not a whole number: '8.5'",
        "line 4: skipped, invalid date 'not-a-date'",
    ]


def test_blank_rows_are_ignored() -> None:
    result = parse(",,,,,,,,\n2026-07-19,Day1,Hack Squat,1,60.0,8,Legs,,\n,,,,,,,,\n")
    assert result.set_count == 1
    assert result.warnings == []


def test_rejects_a_file_that_is_not_the_legacy_log() -> None:
    with pytest.raises(LegacySheetError, match="missing column"):
        parse("", header="Exercise,Muscle Group,Sets Logged\n")
