from sqlalchemy import Column, Integer, String, ForeignKey, Date, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    name = Column(String(150), nullable=False)
    roll_no = Column(String(50), unique=True, nullable=False)
    date_of_birth = Column(Date, nullable=True)
    email = Column(String(150), nullable=True)
    phone = Column(String(15), nullable=True)
    gender = Column(String(10), nullable=True)
    address = Column(String(300), nullable=True)
    guardian_name = Column(String(150), nullable=True)
    guardian_phone = Column(String(15), nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    semester_id = Column(Integer, ForeignKey("semesters.id"), nullable=False)
    admission_year = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="student")
    branch = relationship("Branch", back_populates="students")
    semester = relationship("Semester", back_populates="students")
    attendances = relationship("Attendance", back_populates="student")