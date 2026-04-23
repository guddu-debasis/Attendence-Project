import csv
import re
from datetime import date, datetime
from io import StringIO
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.attendance import Attendance, AttendanceStatus
from app.models.subject import Subject
from app.models.student import Student
from app.models.teacher import Teacher

from app.schemas.attendance import (
    BulkAttendanceRequest,
    AttendanceUpdate,
    AttendanceDetailResponse,
)


def _get_teacher_by_user(user_id: int, db: Session) -> Teacher:
    teacher = db.query(Teacher).filter(Teacher.user_id == user_id).first()
    if not teacher:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Teacher profile not found")
    return teacher


def _authorize_subject(teacher: Teacher, subject_id: int, db: Session) -> Subject:
    """Ensure the teacher is assigned to the subject."""
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subject not found")
    if subject.teacher_id != teacher.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "You are not assigned to this subject",
        )
    return subject


def _build_report_filename(subject: Subject) -> str:
    raw_name = f"{subject.code}_class_attendance_report.csv"
    sanitized = re.sub(r"[^A-Za-z0-9._-]+", "_", raw_name).strip("._")
    return sanitized or "attendance_report.csv"



def mark_bulk_attendance(
    payload: BulkAttendanceRequest,
    current_user_id: int,
    db: Session,
) -> dict:
    teacher = _get_teacher_by_user(current_user_id, db)
    subject = _authorize_subject(teacher, payload.subject_id, db)

    updated = 0
    created = 0

    for entry in payload.entries:
        student = db.query(Student).filter(Student.id == entry.student_id).first()
        if not student:
            continue  

        existing = (
            db.query(Attendance)
            .filter(
                Attendance.student_id == entry.student_id,
                Attendance.subject_id == subject.id,
                Attendance.date == payload.date,
            )
            .first()
        )

        if existing:
            existing.status = entry.status
            existing.marked_by_id = teacher.id
            updated += 1
        else:
            record = Attendance(
                student_id=entry.student_id,
                subject_id=subject.id,
                date=payload.date,
                status=entry.status,
                marked_by_id=teacher.id,
            )
            db.add(record)
            created += 1

    db.commit()
    return {
        "message": "Attendance saved",
        "date": str(payload.date),
        "subject": subject.name,
        "created": created,
        "updated": updated,
    }



def get_attendance_by_date(
    subject_id: int,
    attendance_date: date,
    current_user_id: int,
    db: Session,
) -> list[AttendanceDetailResponse]:
    teacher = _get_teacher_by_user(current_user_id, db)
    subject = _authorize_subject(teacher, subject_id, db)

    records = (
        db.query(Attendance)
        .filter(
            Attendance.subject_id == subject.id,
            Attendance.date == attendance_date,
        )
        .all()
    )

    result = []
    for r in records:
        result.append(
            AttendanceDetailResponse(
                id=r.id,
                student_id=r.student_id,
                student_name=r.student.name,
                roll_no=r.student.roll_no,
                subject_id=r.subject_id,
                subject_name=subject.name,
                date=r.date,
                status=r.status,
                marked_by_name=teacher.name,
            )
        )
    return result



def get_attendance_dates(
    subject_id: int,
    current_user_id: int,
    db: Session,
) -> list[str]:
    teacher = _get_teacher_by_user(current_user_id, db)
    subject = _authorize_subject(teacher, subject_id, db)

    rows = (
        db.query(Attendance.date)
        .filter(Attendance.subject_id == subject.id)
        .distinct()
        .order_by(Attendance.date.desc())
        .all()
    )
    return [str(r.date) for r in rows]



def update_attendance_record(
    attendance_id: int,
    payload: AttendanceUpdate,
    current_user_id: int,
    db: Session,
) -> AttendanceDetailResponse:
    teacher = _get_teacher_by_user(current_user_id, db)

    record = db.query(Attendance).filter(Attendance.id == attendance_id).first()
    if not record:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attendance record not found")

    
    _authorize_subject(teacher, record.subject_id, db)

    record.status = payload.status
    record.marked_by_id = teacher.id
    db.commit()
    db.refresh(record)

    return AttendanceDetailResponse(
        id=record.id,
        student_id=record.student_id,
        student_name=record.student.name,
        roll_no=record.student.roll_no,
        subject_id=record.subject_id,
        subject_name=record.subject.name,
        date=record.date,
        status=record.status,
        marked_by_name=teacher.name,
    )



def get_my_subjects(current_user_id: int, db: Session) -> list[dict]:
    teacher = _get_teacher_by_user(current_user_id, db)
    subjects = db.query(Subject).filter(Subject.teacher_id == teacher.id).all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "code": s.code,
            "branch": s.branch.name if s.branch else None,
            "semester": s.semester.name if s.semester else None,
        }
        for s in subjects
    ]



def get_students_for_subject(
    subject_id: int,
    current_user_id: int,
    db: Session,
) -> list[dict]:
    teacher = _get_teacher_by_user(current_user_id, db)
    subject = _authorize_subject(teacher, subject_id, db)

    students = (
        db.query(Student)
        .filter(
            Student.branch_id == subject.branch_id,
            Student.semester_id == subject.semester_id,
        )
        .order_by(Student.roll_no)
        .all()
    )
    return [
        {"id": s.id, "name": s.name, "roll_no": s.roll_no}
        for s in students
    ]


def export_class_attendance_report(
    subject_id: int,
    current_user_id: int,
    db: Session,
) -> tuple[str, str]:
    teacher = _get_teacher_by_user(current_user_id, db)
    subject = _authorize_subject(teacher, subject_id, db)

    students = (
        db.query(Student)
        .filter(
            Student.branch_id == subject.branch_id,
            Student.semester_id == subject.semester_id,
        )
        .order_by(Student.roll_no)
        .all()
    )

    records = (
        db.query(Attendance)
        .filter(Attendance.subject_id == subject.id)
        .order_by(Attendance.date.asc())
        .all()
    )

    total_classes = len({record.date for record in records})
    records_by_student: dict[int, list[Attendance]] = {}
    for record in records:
        records_by_student.setdefault(record.student_id, []).append(record)

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Student Name",
        "Roll No",
        "Subject",
        "Subject Code",
        "Teacher",
        "Branch",
        "Semester",
        "Classes Attended",
        "Total Classes Held",
        "Classes Missed",
        "Attendance Percentage",
        "Report Generated At",
    ])

    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    branch_name = subject.branch.name if subject.branch else ""
    semester_name = subject.semester.name if subject.semester else ""
    for student in students:
        student_records = records_by_student.get(student.id, [])
        present = sum(1 for record in student_records if record.status == AttendanceStatus.present)
        missed = max(total_classes - present, 0)
        percentage = round((present / total_classes) * 100, 2) if total_classes else 0.0
        writer.writerow([
            student.name,
            student.roll_no,
            subject.name,
            subject.code,
            teacher.name,
            branch_name,
            semester_name,
            present,
            total_classes,
            missed,
            percentage,
            generated_at,
        ])

    return "\ufeff" + output.getvalue(), _build_report_filename(subject)
