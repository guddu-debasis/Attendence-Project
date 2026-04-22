from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Semester(Base):
    __tablename__ = "semesters"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)       # e.g. Semester 1
    number = Column(Integer, nullable=False)        # 1-8
    academic_year = Column(String(20), nullable=False)  # e.g. 2024-25
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    subjects = relationship("Subject", back_populates="semester")
    students = relationship("Student", back_populates="semester")