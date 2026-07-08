# app/models/compliance_models.py
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from sqlalchemy.sql import func
from app.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    actor = Column(String, index=True) # e.g., "Doctor"
    action = Column(String, index=True) # e.g., "Approved AI Summary"
    patient_id = Column(Integer, nullable=True)
    details = Column(Text, nullable=True)

class ConsentRecord(Base):
    __tablename__ = "consent_records"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, index=True)
    consent_given = Column(Boolean, default=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    consent_type = Column(String, default="AI_Analysis")