from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamps, UUIDPrimaryKey


class User(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("default_rest_seconds BETWEEN 15 AND 600", name="default_rest_range"),
    )

    # Stored lower-cased. A user can exist before their first Google login (e.g. created
    # by a data import); the Google account is linked by email on first sign-in.
    email: Mapped[str] = mapped_column(String(320), unique=True)
    google_sub: Mapped[str | None] = mapped_column(String(255), unique=True)
    name: Mapped[str | None] = mapped_column(String(200))
    avatar_url: Mapped[str | None] = mapped_column(String(2048))
    # Set once the first-open questions (routine, rest time) have been answered.
    setup_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Rest timer: starts after each set unless switched off. Exercises without their own
    # rest time get a smart default (computed in the app); this is the fallback for those.
    rest_timer_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    default_rest_seconds: Mapped[int] = mapped_column(Integer, default=90, server_default="90")
