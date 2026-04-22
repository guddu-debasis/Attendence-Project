from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.utils.dependencies import get_teacher_user

from app.schemas.attendance import (
    BulkAttendanceRequest,
    AttendanceUpdate,
    AttendanceDetailResponse,
)
import app.services.teacher_service as teacher_svc

router = APIRouter(prefix="/api/teacher", tags=["Teacher"])


@router.get("/subjects")
def my_subjects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_teacher_user),
):
    """List all subjects assigned to the logged-in teacher."""
    return teacher_svc.get_my_subjects(current_user.id, db)


@router.get("/subjects/{subject_id}/students")
def students_for_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_teacher_user),
):
    """Return students enrolled in the branch+semester of this subject."""
    return teacher_svc.get_students_for_subject(subject_id, current_user.id, db)


@router.post("/attendance", status_code=201)
def mark_attendance(
    payload: BulkAttendanceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_teacher_user),
):
    """
    Mark or overwrite attendance for an entire class on a given date.
    Send a list of {student_id, status} entries.
    """
    return teacher_svc.mark_bulk_attendance(payload, current_user.id, db)


@router.get("/attendance/{subject_id}/dates")
def get_attendance_dates(
    subject_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_teacher_user),
):
    """List all dates for which attendance has been marked for this subject."""
    return teacher_svc.get_attendance_dates(subject_id, current_user.id, db)


@router.get("/attendance/{subject_id}", response_model=list[AttendanceDetailResponse])
def get_attendance(
    subject_id: int,
    date: date = Query(..., description="Format: YYYY-MM-DD"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_teacher_user),
):
    """Fetch attendance records for a subject on a specific date."""
    return teacher_svc.get_attendance_by_date(subject_id, date, current_user.id, db)


@router.patch("/attendance/record/{attendance_id}", response_model=AttendanceDetailResponse)
def modify_attendance(
    attendance_id: int,
    payload: AttendanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_teacher_user),
):
    """Modify present ↔ absent for an individual attendance record."""
    return teacher_svc.update_attendance_record(attendance_id, payload, current_user.id, db)