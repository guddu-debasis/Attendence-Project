from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    name = Column(String(150), nullable=False)
    employee_id = Column(String(50), unique=True, nullable=False)   # T001, T002 ...
    email = Column(String(150), unique=True, nullable=False)
    phone = Column(String(15), nullable=True)
    department = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="teacher")
    subjects = relationship("Subject", back_populates="teacher")
    attendances_marked = relationship("Attendance", back_populates="marked_by")

    @property
    def is_active(self) -> bool:
        return bool(self.user and self.user.is_active)
