from pydantic import BaseModel
from app.models.user import UserRole


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    user_id: int


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class TokenData(BaseModel):
    username: str | None = None
    role: UserRole | None = None
    user_id: int | None = None