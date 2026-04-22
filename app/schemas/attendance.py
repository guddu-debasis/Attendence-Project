from pydantic import BaseModel
from datetime import date, datetime
from app.models.attendance import AttendanceStatus



class AttendanceEntry(BaseModel):
    student_id: int
    status: AttendanceStatus



class BulkAttendanceRequest(BaseModel):
    subject_id: int
    date: date
    entries: list[AttendanceEntry]



class AttendanceUpdate(BaseModel):
    status: AttendanceStatus



class AttendanceResponse(BaseModel):
    id: int
    student_id: int
    subject_id: int
    date: date
    status: AttendanceStatus
    marked_by_id: int
    created_at: datetime
    updated_at: datetime | None

    model_config = {"from_attributes": True}


class AttendanceDetailResponse(BaseModel):
    """Enriched view returned to teachers / admin."""
    id: int
    student_id: int
    student_name: str
    roll_no: str
    subject_id: int
    subject_name: str
    date: date
    status: AttendanceStatus
    marked_by_name: str

    model_config = {"from_attributes": True}


class StudentAttendanceSummary(BaseModel):
    """Per-subject summary returned to a student."""
    subject_id: int
    subject_name: str
    subject_code: str
    total_classes: int
    present: int
    absent: int
    percentage: float