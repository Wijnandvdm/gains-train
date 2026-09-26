from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

# 0 = no rest timer for this exercise; otherwise up to 15 minutes.
RestSeconds = Annotated[int, Field(ge=0, le=900)]


class ExercisePreferenceIn(BaseModel):
    rest_seconds: RestSeconds


class ExercisePreferenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    exercise_id: int
    rest_seconds: int
