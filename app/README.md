# Student Attendance Management System

A modern, role-based Student Attendance Management System.

---

## Problem It Solves

Manual attendance tracking in engineering colleges is time-consuming, error-prone, and difficult to manage for monthly reports and eligibility checks (75% attendance rule).

SAMS automates the entire process — from daily attendance marking to generating accurate reports — with the university rule of capping 30 classes per subject.

---

## How It Solves

- **Teachers** can mark attendance daily through a clean API interface.
- **Automatic calculation** of attendance percentage with the max 30 classes rule.
- **Clear Eligible / Not Eligible** status for each subject.
- **Students** can view their own attendance anytime.
- **Centralized database** with proper university structure (Branch → Semester → Subject → Attendance).

---

## Features

### For Students
- Login and view personal attendance dashboard
- Subject-wise attendance details
- Overall attendance percentage per subject
- Eligible / Not Eligible status
- 30-class cap clearly applied

### For Teachers
- Login and view assigned subjects
- Mark bulk daily attendance for a class
- View attendance records by date
- Modify individual attendance records (present ↔ absent)

### For Administrators
- Full management via REST API (Swagger UI at `/docs`)
- Manage Users, Branches, Semesters, Subjects, Students & Teachers
- Bulk import students via Google Form CSV export
- Enable/disable accounts and reset passwords

### General
- Role-based access control (Student / Teacher / Admin)
- JWT authentication — stateless and secure
- Auto-seeded admin account on first startup
- MySQL database with SQLAlchemy ORM

---

## Project Structure

```
attendance_system/
├── run.py                        # Entry point
├── requirements.txt
├── .env                          # Environment variables (never commit)
├── .gitignore
└── app/
    ├── main.py                   # FastAPI app, lifespan, router registration
    ├── config.py                 # Settings loaded from .env
    ├── database.py               # SQLAlchemy engine, session, Base
    │
    ├── models/                   # SQLAlchemy ORM table definitions
    │   ├── user.py               # User (admin / teacher / student)
    │   ├── branch.py             # Branch (CSE, ECE, …)
    │   ├── semester.py           # Semester 1–8
    │   ├── subject.py            # Subject per branch per semester
    │   ├── teacher.py            # Teacher profile
    │   ├── student.py            # Student profile
    │   └── attendance.py         # Attendance record (present / absent)
    │
    ├── schemas/                  # Pydantic request/response models
    │   ├── auth.py
    │   ├── branch.py
    │   ├── semester.py
    │   ├── subject.py
    │   ├── teacher.py
    │   ├── student.py
    │   └── attendance.py
    │
    ├── controllers/              # FastAPI routers — HTTP layer only
    │   ├── auth_controller.py
    │   ├── admin_controller.py
    │   ├── teacher_controller.py
    │   └── student_controller.py
    │
    ├── services/                 # Business logic
    │   ├── auth_service.py
    │   ├── admin_service.py
    │   ├── teacher_service.py
    │   └── student_service.py
    │
    └── utils/
        ├── security.py           # JWT creation/decode, bcrypt helpers
        ├── dependencies.py       # FastAPI Depends — auth guards per role
        └── google_form_parser.py # CSV parser for Google Form exports
```

---

## Setup Instructions

### 1. Prerequisites
- Python 3.11+
- MySQL 8.0+

### 2. Create the Database
```sql
CREATE DATABASE attendance_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. Clone & Install
```bash
git clone https://github.com/guddu/sams.git
cd attendance_system
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 4. Configure `.env`
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=attendance_db

SECRET_KEY=replace_with_a_long_random_string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

ADMIN_USERNAME=
ADMIN_PASSWORD=
```

### 5. Run the Server
```bash
python run.py
# or
uvicorn app.main:app --reload
```

Tables are auto-created on startup. The default admin account is seeded automatically.

### 6. Open API Docs
```
http://localhost:8000/docs      ← Swagger UI
http://localhost:8000/redoc     ← ReDoc
```

---

## Architecture Overview

```
HTTP Request
    │
    ▼
Controller  (app/controllers/)   ← validates input, calls service
    │
    ▼
Service     (app/services/)      ← all business logic, DB queries
    │
    ▼
Model       (app/models/)        ← SQLAlchemy ORM table definitions
    │
    ▼
MySQL Database
```

**Authentication flow:**
1. Client POSTs credentials to `/api/auth/login`
2. Server returns a JWT token
3. Client includes `Authorization: Bearer <token>` in every request
4. `get_current_user` dependency decodes the token and injects the user
5. Role-specific guards (`get_admin_user`, `get_teacher_user`, `get_student_user`) protect each router

---

## API Reference

### Auth (`/api/auth`)

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/login` | Any | Login, returns JWT |
| POST | `/change-password` | Any | Change own password |
| GET | `/me` | Any | View own user info |

### Admin (`/api/admin`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/branches` | Create branch |
| GET | `/branches` | List all branches |
| PUT | `/branches/{id}` | Update branch |
| DELETE | `/branches/{id}` | Delete branch |
| POST | `/semesters` | Create semester |
| GET | `/semesters` | List semesters |
| PUT | `/semesters/{id}` | Update semester |
| DELETE | `/semesters/{id}` | Delete semester |
| POST | `/subjects` | Create subject for branch + semester |
| GET | `/subjects?branch_id=&semester_id=` | List subjects (filterable) |
| PUT | `/subjects/{id}` | Update subject |
| DELETE | `/subjects/{id}` | Delete subject |
| PATCH | `/subjects/{id}/assign-teacher` | Assign teacher to subject |
| POST | `/teachers` | Create teacher + login credentials |
| GET | `/teachers` | List all teachers |
| PUT | `/teachers/{id}` | Update teacher info |
| DELETE | `/teachers/{id}` | Delete teacher + account |
| PATCH | `/teachers/{id}/toggle-active` | Enable/disable teacher account |
| POST | `/students/import-csv` | Bulk import students from Google Form CSV |
| GET | `/students?branch_id=&semester_id=` | List students (filterable) |
| GET | `/students/{id}` | Student detail |
| PATCH | `/students/{id}/toggle-active` | Enable/disable student account |
| PATCH | `/students/{id}/reset-password` | Reset student password to roll number |

### Teacher (`/api/teacher`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/subjects` | My assigned subjects |
| GET | `/subjects/{id}/students` | Students in that subject's class |
| POST | `/attendance` | Mark bulk attendance for a date |
| GET | `/attendance/{subject_id}?date=YYYY-MM-DD` | View attendance on a date |
| GET | `/attendance/{subject_id}/dates` | All dates with attendance recorded |
| PATCH | `/attendance/record/{id}` | Modify a single record (present ↔ absent) |

### Student (`/api/student`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/profile` | My profile |
| GET | `/attendance/summary` | Per-subject summary (%, present, absent) |
| GET | `/attendance/{subject_id}` | Date-wise detail for one subject |

---

## Google Form CSV Format

Create a Google Form with the fields below and export responses as CSV. Column names are flexible — any listed alias works.

| Form Field | Accepted CSV Column Names |
|-----------|---------------------------|
| Full Name | `name`, `full name`, `student name` |
| Roll Number | `roll_no`, `roll no`, `roll number` |
| Date of Birth | `date_of_birth`, `dob`, `date of birth` |
| Email | `email`, `email address` |
| Phone | `phone`, `mobile` |
| Gender | `gender`, `sex` |
| Address | `address` |
| Guardian Name | `guardian_name`, `parent name` |
| Guardian Phone | `guardian_phone`, `parent phone` |
| Branch Code | `branch_code`, `branch` ← must match a Branch code in the DB |
| Semester No | `semester_number`, `semester`, `sem` |
| Admission Year | `admission_year`, `joining year` |

Upload at: `POST /api/admin/students/import-csv`

---

## Login Information

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin@123` |
| Teacher | set by admin | set by admin |
| Student | `<roll_no>` | `<roll_no>` |

> **Important:** Change the admin password immediately after first login.  
> Students can change their password at `POST /api/auth/change-password` after first login.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | FastAPI |
| Database | MySQL (via SQLAlchemy ORM) |
| Auth | JWT (python-jose) + bcrypt (passlib) |
| CSV Parsing | Pandas |
| Config | pydantic-settings + .env |
| Server | Uvicorn |
