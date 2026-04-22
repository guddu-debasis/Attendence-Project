from pydantic import BaseModel, EmailStr
from datetime import datetime


class TeacherCreate(BaseModel):
    name: str
    employee_id: str
    email: EmailStr
    phone: str | None = None
    department: str | None = None
    username: str
    password: str


class TeacherUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    department: str | None = None


class TeacherResponse(BaseModel):
    id: int
    name: str
    employee_id: str
    email: str
    phone: str | None
    department: str | None
    user_id: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TeacherWithUsernameResponse(TeacherResponse):
    username: str
