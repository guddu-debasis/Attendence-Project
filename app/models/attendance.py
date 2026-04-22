from sqlalchemy import (
    Column, Integer, ForeignKey, Date, DateTime,
    Enum, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class AttendanceStatus(str, enum.Enum):
    present = "present"
    absent = "absent"


class Attendance(Base):
    __tablename__ = "attendances"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    date = Column(Date, nullable=False)
    status = Column(Enum(AttendanceStatus), nullable=False)
    marked_by_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    
    __table_args__ = (
        UniqueConstraint("student_id", "subject_id", "date", name="uq_attendance"),
    )

    
    student = relationship("Student", back_populates="attendances")
    subject = relationship("Subject", back_populates="attendances")
    marked_by = relationship("Teacher", back_populates="attendances_marked")