from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.auth import LoginRequest, TokenResponse, ChangePasswordRequest
from app.models.user import User
from app.utils.dependencies import get_current_user
import app.services.auth_service as auth_service

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Login for all roles (admin / teacher / student)."""
    return auth_service.login(payload, db)


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Any authenticated user can change their own password."""
    return auth_service.change_password(current_user, payload, db)


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """Return basic info about the logged-in user."""
    return {
        "id": current_user.id,
        "username": current_user.username,
        "role": current_user.role,
        "is_active": current_user.is_active,
    }