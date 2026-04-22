from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.database import engine, SessionLocal, Base
from app.config import get_settings


import app.models  

from app.controllers import (
    auth_controller,
    admin_controller,
    teacher_controller,
    student_controller,
)
from app.models.user import User, UserRole
from app.utils.security import hash_password

settings = get_settings()


def seed_admin(db) -> None:
    """Create the default admin account if it doesn't already exist."""
    existing = db.query(User).filter(User.username == settings.ADMIN_USERNAME).first()
    if not existing:
        admin = User(
            username=settings.ADMIN_USERNAME,
            hashed_password=hash_password(settings.ADMIN_PASSWORD),
            role=UserRole.admin,
        )
        db.add(admin)
        db.commit()
        print(f"[startup] Admin account created → username: {settings.ADMIN_USERNAME}")
    else:
        print("[startup] Admin account already exists")


@asynccontextmanager
async def lifespan(app: FastAPI):
    
    print("[startup] Creating database tables...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_admin(db)
    finally:
        db.close()
    print("[startup] Ready ✓")
    yield
    
    print("[shutdown] Goodbye")


app = FastAPI(
    title="University Attendance Management System",
    description=(
        "Role-based attendance system for Universities. "
        "Roles: **admin**, **teacher**, **student**."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_controller.router)
app.include_router(admin_controller.router)
app.include_router(teacher_controller.router)
app.include_router(student_controller.router)


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "message": "Attendance Management System API"}


@app.get("/health", tags=["Health"])
def health():
    return {"status": "healthy"}