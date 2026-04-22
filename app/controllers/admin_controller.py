from fastapi import APIRouter, Depends, UploadFile, File, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.utils.dependencies import get_admin_user

from app.schemas.branch import BranchCreate, BranchUpdate, BranchResponse
from app.schemas.semester import SemesterCreate, SemesterUpdate, SemesterResponse
from app.schemas.subject import SubjectCreate, SubjectUpdate, AssignTeacherRequest, SubjectResponse
from app.schemas.teacher import TeacherCreate, TeacherUpdate, TeacherResponse
from app.schemas.student import BulkImportResponse

import app.services.admin_service as admin_svc

router = APIRouter(prefix="/api/admin", tags=["Admin"])




@router.post("/branches", response_model=BranchResponse, status_code=201)
def create_branch(
    payload: BranchCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    return admin_svc.create_branch(payload, db)


@router.get("/branches", response_model=list[BranchResponse])
def list_branches(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    return admin_svc.get_all_branches(db)


@router.get("/branches/{branch_id}", response_model=BranchResponse)
def get_branch(
    branch_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    return admin_svc.get_branch(branch_id, db)


@router.put("/branches/{branch_id}", response_model=BranchResponse)
def update_branch(
    branch_id: int,
    payload: BranchUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    return admin_svc.update_branch(branch_id, payload, db)


@router.delete("/branches/{branch_id}")
def delete_branch(
    branch_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    return admin_svc.delete_branch(branch_id, db)



@router.post("/semesters", response_model=SemesterResponse, status_code=201)
def create_semester(
    payload: SemesterCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    return admin_svc.create_semester(payload, db)


@router.get("/semesters", response_model=list[SemesterResponse])
def list_semesters(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    return admin_svc.get_all_semesters(db)


@router.get("/semesters/{sem_id}", response_model=SemesterResponse)
def get_semester(
    sem_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    return admin_svc.get_semester(sem_id, db)


@router.put("/semesters/{sem_id}", response_model=SemesterResponse)
def update_semester(
    sem_id: int,
    payload: SemesterUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    return admin_svc.update_semester(sem_id, payload, db)


@router.delete("/semesters/{sem_id}")
def delete_semester(
    sem_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    return admin_svc.delete_semester(sem_id, db)



@router.post("/subjects", response_model=SubjectResponse, status_code=201)
def create_subject(
    payload: SubjectCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    return admin_svc.create_subject(payload, db)


@router.get("/subjects", response_model=list[SubjectResponse])
def list_subjects(
    branch_id: int | None = Query(None),
    semester_id: int | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    return admin_svc.get_all_subjects(db, branch_id, semester_id)


@router.get("/subjects/{subject_id}", response_model=SubjectResponse)
def get_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    return admin_svc.get_subject(subject_id, db)


@router.put("/subjects/{subject_id}", response_model=SubjectResponse)
def update_subject(
    subject_id: int,
    payload: SubjectUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    return admin_svc.update_subject(subject_id, payload, db)


@router.delete("/subjects/{subject_id}")
def delete_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    return admin_svc.delete_subject(subject_id, db)


@router.patch("/subjects/{subject_id}/assign-teacher", response_model=SubjectResponse)
def assign_teacher(
    subject_id: int,
    payload: AssignTeacherRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    """Assign a teacher to a subject."""
    return admin_svc.assign_teacher_to_subject(subject_id, payload, db)



@router.post("/teachers", status_code=201)
def create_teacher(
    payload: TeacherCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    """Create a teacher + their login credentials."""
    result = admin_svc.create_teacher(payload, db)
    return {
        "message": "Teacher created successfully",
        "username": result["username"],
        "teacher_id": result["teacher"].id,
        "employee_id": result["teacher"].employee_id,
    }


@router.get("/teachers", response_model=list[TeacherResponse])
def list_teachers(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    return admin_svc.get_all_teachers(db)


@router.get("/teachers/{teacher_id}", response_model=TeacherResponse)
def get_teacher(
    teacher_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    return admin_svc.get_teacher(teacher_id, db)


@router.put("/teachers/{teacher_id}", response_model=TeacherResponse)
def update_teacher(
    teacher_id: int,
    payload: TeacherUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    return admin_svc.update_teacher(teacher_id, payload, db)


@router.delete("/teachers/{teacher_id}")
def delete_teacher(
    teacher_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    return admin_svc.delete_teacher(teacher_id, db)


@router.patch("/teachers/{teacher_id}/toggle-active")
def toggle_teacher_active(
    teacher_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    return admin_svc.toggle_teacher_active(teacher_id, db)



@router.post("/students/import-csv", response_model=BulkImportResponse, status_code=201)
async def import_students(
    file: UploadFile = File(..., description="Google Form CSV export"),
    active_semester_id: int | None = Query(None, description="Restrict import to this semester"),
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    """
    Upload the Google Form CSV to bulk-create student accounts.
    Default password for each student = their roll number.
    """
    contents = await file.read()
    return admin_svc.import_students_from_csv(contents, db, active_semester_id)


@router.get("/students")
def list_students(
    branch_id: int | None = Query(None),
    semester_id: int | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    students = admin_svc.get_all_students(db, branch_id, semester_id)
    return [
        {
            "id": s.id,
            "name": s.name,
            "roll_no": s.roll_no,
            "email": s.email,
            "branch_id": s.branch_id,
            "semester_id": s.semester_id,
            "is_active": s.user.is_active,
        }
        for s in students
    ]


@router.get("/students/{student_id}")
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    s = admin_svc.get_student(student_id, db)
    return {
        "id": s.id,
        "name": s.name,
        "roll_no": s.roll_no,
        "date_of_birth": str(s.date_of_birth) if s.date_of_birth else None,
        "email": s.email,
        "phone": s.phone,
        "gender": s.gender,
        "address": s.address,
        "guardian_name": s.guardian_name,
        "guardian_phone": s.guardian_phone,
        "branch": s.branch.name if s.branch else None,
        "semester": s.semester.name if s.semester else None,
        "admission_year": s.admission_year,
        "is_active": s.user.is_active,
    }


@router.patch("/students/{student_id}/toggle-active")
def toggle_student_active(
    student_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    return admin_svc.toggle_student_active(student_id, db)


@router.patch("/students/{student_id}/reset-password")
def reset_student_password(
    student_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    """Reset student password back to their roll number."""
    return admin_svc.reset_student_password(student_id, db)