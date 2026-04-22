# Frontend

This folder contains a self-contained frontend for your FastAPI attendance backend.

## What it supports

- Login with `admin`, `teacher`, or `student` credentials
- Admin workflows:
  - branches CRUD
  - semesters CRUD
  - subjects CRUD
  - teacher assignment to subjects
  - teacher create, update, toggle, delete
  - student CSV import
  - student list, filters, detail view, toggle, password reset
- Teacher workflows:
  - assigned subjects
  - mark bulk attendance
  - browse attendance dates
  - update single attendance records
- Student workflows:
  - profile
  - attendance summary
  - subject-wise attendance detail

## Run

1. Start the backend from `D:\Attendence Project`:

```powershell
python run.py
```

2. Open `D:\Attendence Project\frontend\index.html` in a browser.

3. Keep the backend API config set to:

```text
http://localhost:8000
```

The backend URL is no longer shown in the UI. It is configured internally in:

```text
D:\Attendence Project\frontend\index.html
```

Edit `window.ATTENDANCE_CONFIG.apiBase` there if your backend runs on a different host or port.

If you prefer serving the frontend over HTTP instead of opening the file directly, you can run:

```powershell
cd "D:\Attendence Project\frontend"
python -m http.server 5500
```

Then open:

```text
http://localhost:5500
```
