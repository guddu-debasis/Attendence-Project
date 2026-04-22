from pydantic import BaseModel, EmailStr
from datetime import date, datetime


class StudentCreate(BaseModel):
    name: str
    roll_no: str
    date_of_birth: date | None = None
    email: EmailStr | None = None
    phone: str | None = None
    gender: str | None = None
    address: str | None = None
    guardian_name: str | None = None
    guardian_phone: str | None = None
    branch_id: int
    semester_id: int
    admission_year: int | None = None


class StudentUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    guardian_name: str | None = None
    guardian_phone: str | None = None
    semester_id: int | None = None


class StudentResponse(BaseModel):
    id: int
    name: str
    roll_no: str
    date_of_birth: date | None
    email: str | None
    phone: str | None
    gender: str | None
    address: str | None
    guardian_name: str | None
    guardian_phone: str | None
    branch_id: int
    semester_id: int
    admission_year: int | None
    user_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class StudentDetailResponse(StudentResponse):
    branch_name: str | None = None
    semester_name: str | None = None



class GoogleFormRow(BaseModel):
    name: str
    roll_no: str
    date_of_birth: str | None = None   
    email: str | None = None
    phone: str | None = None
    gender: str | None = None
    address: str | None = None
    guardian_name: str | None = None
    guardian_phone: str | None = None
    branch_code: str               
    semester_number: int           
    admission_year: int | None = None


class BulkImportResponse(BaseModel):
    total_rows: int
    created: int
    skipped: int
    errors: list[str]