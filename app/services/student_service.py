from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.student import Student
from app.models.attendance import Attendance
from app.models.subject import Subject
from app.schemas.attendance import StudentAttendanceSummary


def _get_student_by_user(user_id: int, db: Session) -> Student:
    student = db.query(Student).filter(Student.user_id == user_id).first()
    if not student:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student profile not found")
    return student


def get_my_profile(user_id: int, db: Session) -> Student:
    return _get_student_by_user(user_id, db)


def get_my_attendance_summary(user_id: int, db: Session) -> list[StudentAttendanceSummary]:
    student = _get_student_by_user(user_id, db)

   
    subjects = (
        db.query(Subject)
        .filter(
            Subject.branch_id == student.branch_id,
            Subject.semester_id == student.semester_id,
        )
        .all()
    )

    summaries = []
    for subject in subjects:
        records = (
            db.query(Attendance)
            .filter(
                Attendance.student_id == student.id,
                Attendance.subject_id == subject.id,
            )
            .all()
        )
        total = len(records)
        present = sum(1 for r in records if r.status.value == "present")
        absent = total - present
        percentage = round((present / total) * 100, 2) if total > 0 else 0.0

        summaries.append(
            StudentAttendanceSummary(
                subject_id=subject.id,
                subject_name=subject.name,
                subject_code=subject.code,
                total_classes=total,
                present=present,
                absent=absent,
                percentage=percentage,
            )
        )
    return summaries


def get_my_attendance_detail(
    user_id: int, subject_id: int, db: Session
) -> list[dict]:
    student = _get_student_by_user(user_id, db)

    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subject not found")

    
    if (
        subject.branch_id != student.branch_id
        or subject.semester_id != student.semester_id
    ):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "This subject is not part of your curriculum",
        )

    records = (
        db.query(Attendance)
        .filter(
            Attendance.student_id == student.id,
            Attendance.subject_id == subject_id,
        )
        .order_by(Attendance.date.asc())
        .all()
    )

    return [
        {"date": str(r.date), "status": r.status.value}
        for r in records
    ]