from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status

from app.models.user import User, UserRole
from app.models.branch import Branch
from app.models.semester import Semester
from app.models.subject import Subject
from app.models.teacher import Teacher
from app.models.student import Student

from app.schemas.branch import BranchCreate, BranchUpdate
from app.schemas.semester import SemesterCreate, SemesterUpdate
from app.schemas.subject import SubjectCreate, SubjectUpdate, AssignTeacherRequest
from app.schemas.teacher import TeacherCreate, TeacherUpdate
from app.schemas.student import BulkImportResponse

from app.utils.security import hash_password
from app.utils.google_form_parser import parse_google_form_csv, parse_date



def create_branch(payload: BranchCreate, db: Session) -> Branch:
    if db.query(Branch).filter(Branch.code == payload.code.upper()).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Branch code already exists")
    branch = Branch(name=payload.name, code=payload.code.upper())
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return branch


def get_all_branches(db: Session) -> list[Branch]:
    return db.query(Branch).all()


def get_branch(branch_id: int, db: Session) -> Branch:
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Branch not found")
    return branch


def update_branch(branch_id: int, payload: BranchUpdate, db: Session) -> Branch:
    branch = get_branch(branch_id, db)
    if payload.name:
        branch.name = payload.name
    if payload.code:
        branch.code = payload.code.upper()
    db.commit()
    db.refresh(branch)
    return branch


def delete_branch(branch_id: int, db: Session) -> dict:
    branch = get_branch(branch_id, db)
    db.delete(branch)
    db.commit()
    return {"message": f"Branch '{branch.name}' deleted"}



def create_semester(payload: SemesterCreate, db: Session) -> Semester:
    semester = Semester(**payload.model_dump())
    db.add(semester)
    db.commit()
    db.refresh(semester)
    return semester


def get_all_semesters(db: Session) -> list[Semester]:
    return db.query(Semester).all()


def get_semester(sem_id: int, db: Session) -> Semester:
    sem = db.query(Semester).filter(Semester.id == sem_id).first()
    if not sem:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Semester not found")
    return sem


def update_semester(sem_id: int, payload: SemesterUpdate, db: Session) -> Semester:
    sem = get_semester(sem_id, db)
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(sem, field, val)
    db.commit()
    db.refresh(sem)
    return sem


def delete_semester(sem_id: int, db: Session) -> dict:
    sem = get_semester(sem_id, db)
    db.delete(sem)
    db.commit()
    return {"message": f"Semester '{sem.name}' deleted"}



def create_subject(payload: SubjectCreate, db: Session) -> Subject:
    
    get_branch(payload.branch_id, db)
    get_semester(payload.semester_id, db)

    existing = (
        db.query(Subject)
        .filter(
            Subject.code == payload.code,
            Subject.branch_id == payload.branch_id,
            Subject.semester_id == payload.semester_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Subject already exists for this branch/semester")

    subject = Subject(**payload.model_dump())
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


def get_all_subjects(db: Session, branch_id: int | None = None, semester_id: int | None = None):
    q = db.query(Subject)
    if branch_id:
        q = q.filter(Subject.branch_id == branch_id)
    if semester_id:
        q = q.filter(Subject.semester_id == semester_id)
    return q.all()


def get_subject(subject_id: int, db: Session) -> Subject:
    s = db.query(Subject).filter(Subject.id == subject_id).first()
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subject not found")
    return s


def update_subject(subject_id: int, payload: SubjectUpdate, db: Session) -> Subject:
    subject = get_subject(subject_id, db)
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(subject, field, val)
    db.commit()
    db.refresh(subject)
    return subject


def delete_subject(subject_id: int, db: Session) -> dict:
    subject = get_subject(subject_id, db)
    db.delete(subject)
    db.commit()
    return {"message": f"Subject '{subject.name}' deleted"}


def assign_teacher_to_subject(
    subject_id: int, payload: AssignTeacherRequest, db: Session
) -> Subject:
    subject = get_subject(subject_id, db)
    teacher = db.query(Teacher).filter(Teacher.id == payload.teacher_id).first()
    if not teacher:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Teacher not found")
    subject.teacher_id = teacher.id
    db.commit()
    db.refresh(subject)
    return subject



def create_teacher(payload: TeacherCreate, db: Session) -> dict:
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Username already taken")
    if db.query(Teacher).filter(Teacher.employee_id == payload.employee_id).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Employee ID already exists")
    if db.query(Teacher).filter(Teacher.email == payload.email).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email already registered")

    user = User(
        username=payload.username,
        hashed_password=hash_password(payload.password),
        role=UserRole.teacher,
    )
    db.add(user)
    db.flush()  

    teacher = Teacher(
        user_id=user.id,
        name=payload.name,
        employee_id=payload.employee_id,
        email=payload.email,
        phone=payload.phone,
        department=payload.department,
    )
    db.add(teacher)
    db.commit()
    db.refresh(teacher)
    return {"teacher": teacher, "username": payload.username}


def get_all_teachers(db: Session) -> list[Teacher]:
    return db.query(Teacher).options(joinedload(Teacher.user)).all()


def get_teacher(teacher_id: int, db: Session) -> Teacher:
    t = (
        db.query(Teacher)
        .options(joinedload(Teacher.user))
        .filter(Teacher.id == teacher_id)
        .first()
    )
    if not t:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Teacher not found")
    return t


def update_teacher(teacher_id: int, payload: TeacherUpdate, db: Session) -> Teacher:
    teacher = get_teacher(teacher_id, db)
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(teacher, field, val)
    db.commit()
    db.refresh(teacher)
    return teacher


def delete_teacher(teacher_id: int, db: Session) -> dict:
    teacher = get_teacher(teacher_id, db)
    user = teacher.user
    db.delete(teacher)
    db.delete(user)
    db.commit()
    return {"message": f"Teacher '{teacher.name}' and their account deleted"}


def toggle_teacher_active(teacher_id: int, db: Session) -> dict:
    teacher = get_teacher(teacher_id, db)
    teacher.user.is_active = not teacher.user.is_active
    db.commit()
    state = "activated" if teacher.user.is_active else "deactivated"
    return {"message": f"Teacher account {state}"}



def import_students_from_csv(
    file_bytes: bytes,
    db: Session,
    active_semester_id: int | None = None,
) -> BulkImportResponse:
    rows = parse_google_form_csv(file_bytes)

    created = 0
    skipped = 0
    errors: list[str] = []

    for idx, row in enumerate(rows, start=1):
        roll_no = (row.get("roll_no") or "").strip()
        if not roll_no:
            errors.append(f"Row {idx}: missing roll_no, skipped")
            skipped += 1
            continue

        
        if db.query(Student).filter(Student.roll_no == roll_no).first():
            errors.append(f"Row {idx}: roll_no '{roll_no}' already exists, skipped")
            skipped += 1
            continue

        
        branch_code = (row.get("branch_code") or "").upper()
        branch = db.query(Branch).filter(Branch.code == branch_code).first()
        if not branch:
            errors.append(f"Row {idx}: branch '{branch_code}' not found, skipped")
            skipped += 1
            continue

        
        try:
            sem_number = int(row.get("semester_number") or 0)
        except ValueError:
            sem_number = 0

        sem_query = db.query(Semester).filter(Semester.number == sem_number)
        if active_semester_id:
            sem_query = sem_query.filter(Semester.id == active_semester_id)
        semester = sem_query.first()
        if not semester:
            errors.append(f"Row {idx}: semester '{sem_number}' not found, skipped")
            skipped += 1
            continue

       
        if db.query(User).filter(User.username == roll_no).first():
            errors.append(f"Row {idx}: user '{roll_no}' already exists, skipped")
            skipped += 1
            continue

        user = User(
            username=roll_no,
            hashed_password=hash_password(roll_no),  
            role=UserRole.student,
        )
        db.add(user)
        db.flush()

        admission_year = row.get("admission_year")
        student = Student(
            user_id=user.id,
            name=row.get("name", ""),
            roll_no=roll_no,
            date_of_birth=parse_date(row.get("date_of_birth")),
            email=row.get("email"),
            phone=row.get("phone"),
            gender=row.get("gender"),
            address=row.get("address"),
            guardian_name=row.get("guardian_name"),
            guardian_phone=row.get("guardian_phone"),
            branch_id=branch.id,
            semester_id=semester.id,
            admission_year=int(admission_year) if admission_year else None,
        )
        db.add(student)
        created += 1

    db.commit()

    return BulkImportResponse(
        total_rows=len(rows),
        created=created,
        skipped=skipped,
        errors=errors,
    )



def get_all_students(
    db: Session,
    branch_id: int | None = None,
    semester_id: int | None = None,
) -> list[Student]:
    q = db.query(Student)
    if branch_id:
        q = q.filter(Student.branch_id == branch_id)
    if semester_id:
        q = q.filter(Student.semester_id == semester_id)
    return q.all()


def get_student(student_id: int, db: Session) -> Student:
    s = db.query(Student).filter(Student.id == student_id).first()
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")
    return s


def toggle_student_active(student_id: int, db: Session) -> dict:
    student = get_student(student_id, db)
    student.user.is_active = not student.user.is_active
    db.commit()
    state = "activated" if student.user.is_active else "deactivated"
    return {"message": f"Student account {state}"}


def reset_student_password(student_id: int, db: Session) -> dict:
    """Reset student password back to their roll_no."""
    student = get_student(student_id, db)
    student.user.hashed_password = hash_password(student.roll_no)
    db.commit()
    return {"message": f"Password reset to roll number for {student.name}"}
