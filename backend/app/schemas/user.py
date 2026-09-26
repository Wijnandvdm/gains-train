import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str | None
    avatar_url: str | None
    setup_completed_at: datetime | None
    rest_timer_enabled: bool
    default_rest_seconds: int


class MeUpdate(BaseModel):
    """Only the fields that are sent are changed."""

    setup_completed: bool | None = None
    rest_timer_enabled: bool | None = None
    default_rest_seconds: Annotated[int, Field(ge=15, le=600)] | None = None
