from pydantic import BaseModel
from datetime import datetime


class SubjectCreate(BaseModel):
    name: str
    code: str
    branch_id: int
    semester_id: int


class SubjectUpdate(BaseModel):
    name: str | None = None
    code: str | None = None


class AssignTeacherRequest(BaseModel):
    teacher_id: int


class SubjectResponse(BaseModel):
    id: int
    name: str
    code: str
    branch_id: int
    semester_id: int
    teacher_id: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SubjectDetailResponse(SubjectResponse):
    branch_name: str | None = None
    semester_name: str | None = None
    teacher_name: str | None = None