from pydantic import BaseModel
from datetime import datetime


class BranchCreate(BaseModel):
    name: str
    code: str


class BranchUpdate(BaseModel):
    name: str | None = None
    code: str | None = None


class BranchResponse(BaseModel):
    id: int
    name: str
    code: str
    created_at: datetime

    model_config = {"from_attributes": True}