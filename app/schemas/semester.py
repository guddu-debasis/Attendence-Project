from pydantic import BaseModel
from datetime import datetime


class SemesterCreate(BaseModel):
    name: str
    number: int
    academic_year: str
    is_active: bool = True


class SemesterUpdate(BaseModel):
    name: str | None = None
    number: int | None = None
    academic_year: str | None = None
    is_active: bool | None = None


class SemesterResponse(BaseModel):
    id: int
    name: str
    number: int
    academic_year: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}