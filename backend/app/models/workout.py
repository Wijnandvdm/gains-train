import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, Timestamps, UUIDPrimaryKey
from app.models.exercise import Exercise


class WorkoutStatus(enum.StrEnum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class Workout(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "workouts"
    __table_args__ = (
        # Makes imports idempotent: re-importing the same sheet updates instead of duplicating.
        UniqueConstraint("user_id", "import_key"),
        Index("ix_workouts_user_id_performed_on", "user_id", "performed_on"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    # Optional label, e.g. "Day2 · Back & Triceps".
    name: Mapped[str | None] = mapped_column(String(200))
    # The training day. Always known, even for imported workouts that have no clock times.
    performed_on: Mapped[date] = mapped_column(Date)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[WorkoutStatus] = mapped_column(
        Enum(
            WorkoutStatus,
            native_enum=False,
            create_constraint=True,
            length=20,
            name="status",
            values_callable=lambda e: [m.value for m in e],
        ),
        default=WorkoutStatus.IN_PROGRESS,
    )
    notes: Mapped[str | None] = mapped_column(Text)
    # Set only for imported workouts, e.g. "legacy-sheet:2026-07-30:Day1".
    import_key: Mapped[str | None] = mapped_column(String(200))

    exercises: Mapped[list["WorkoutExercise"]] = relationship(
        back_populates="workout",
        cascade="all, delete-orphan",
        order_by="WorkoutExercise.position",
    )


# At most one in-progress workout per user.
Index(
    "uq_workouts_user_id_in_progress",
    Workout.user_id,
    unique=True,
    postgresql_where=Workout.status == WorkoutStatus.IN_PROGRESS,
)


class WorkoutExercise(UUIDPrimaryKey, Base):
    """One exercise performed within a workout, in order."""

    __tablename__ = "workout_exercises"

    workout_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workouts.id", ondelete="CASCADE"), index=True
    )
    exercise_id: Mapped[int] = mapped_column(
        ForeignKey("exercises.id", ondelete="RESTRICT"), index=True
    )
    position: Mapped[int] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)

    workout: Mapped[Workout] = relationship(back_populates="exercises")
    exercise: Mapped[Exercise] = relationship()
    sets: Mapped[list["WorkoutSet"]] = relationship(
        back_populates="workout_exercise",
        cascade="all, delete-orphan",
        order_by="WorkoutSet.position",
    )


class WorkoutSet(UUIDPrimaryKey, Timestamps, Base):
    """A single set. Weight/reps are nullable: a set can be planned but not yet done,
    or (in imported data) have a missing value. Stats only count sets with both."""

    __tablename__ = "sets"
    __table_args__ = (
        CheckConstraint("weight_kg >= 0", name="weight_kg_non_negative"),
        CheckConstraint("reps >= 0", name="reps_non_negative"),
        CheckConstraint("rpe BETWEEN 1 AND 10", name="rpe_range"),
    )

    workout_exercise_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workout_exercises.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column(Integer)
    weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    reps: Mapped[int | None] = mapped_column(Integer)
    rpe: Mapped[Decimal | None] = mapped_column(Numeric(3, 1))
    is_warmup: Mapped[bool] = mapped_column(default=False, server_default="false")
    notes: Mapped[str | None] = mapped_column(Text)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    workout_exercise: Mapped[WorkoutExercise] = relationship(back_populates="sets")
