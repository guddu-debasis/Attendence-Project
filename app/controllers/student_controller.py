from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.utils.dependencies import get_student_user
from app.schemas.attendance import StudentAttendanceSummary
import app.services.student_service as student_svc

router = APIRouter(prefix="/api/student", tags=["Student"])


@router.get("/profile")
def my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_student_user),
):
    """Return the logged-in student's profile."""
    s = student_svc.get_my_profile(current_user.id, db)
    return {
        "id": s.id,
        "name": s.name,
        "roll_no": s.roll_no,
        "email": s.email,
        "phone": s.phone,
        "gender": s.gender,
        "date_of_birth": str(s.date_of_birth) if s.date_of_birth else None,
        "address": s.address,
        "guardian_name": s.guardian_name,
        "guardian_phone": s.guardian_phone,
        "branch": s.branch.name if s.branch else None,
        "semester": s.semester.name if s.semester else None,
        "admission_year": s.admission_year,
    }


@router.get("/attendance/summary", response_model=list[StudentAttendanceSummary])
def attendance_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_student_user),
):
    """
    Return per-subject attendance summary (total, present, absent, percentage)
    for the logged-in student.
    """
    return student_svc.get_my_attendance_summary(current_user.id, db)


@router.get("/attendance/{subject_id}")
def attendance_detail(
    subject_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_student_user),
):
    """Return date-wise attendance for a specific subject."""
    return student_svc.get_my_attendance_detail(current_user.id, subject_id, db)