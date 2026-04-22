from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Branch(Base):
    __tablename__ = "branches"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)               # e.g. Computer Science
    code = Column(String(20), unique=True, nullable=False)   # e.g. CSE
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    students = relationship("Student", back_populates="branch")
    subjects = relationship("Subject", back_populates="branch")