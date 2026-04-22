from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    code = Column(String(30), nullable=False)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    semester_id = Column(Integer, ForeignKey("semesters.id"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=True)  # assigned later
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    branch = relationship("Branch", back_populates="subjects")
    semester = relationship("Semester", back_populates="subjects")
    teacher = relationship("Teacher", back_populates="subjects")
    attendances = relationship("Attendance", back_populates="subject")