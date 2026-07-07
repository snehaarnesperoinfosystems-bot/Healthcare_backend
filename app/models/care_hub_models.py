from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base


class Patient(Base):
    """A patient identified by name — reports are grouped under this."""
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    age = Column(String, nullable=True)
    sex = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    reports = relationship("Report", back_populates="patient", cascade="all, delete-orphan")


class Report(Base):
    """A single analyzed report, linked to a patient, with risk scoring."""
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)

    filename = Column(String, nullable=False)
    
    # 🟢 ADDED: File hash for duplicate prevention
    file_hash = Column(String, index=True, nullable=True) 
    
    sample_date = Column(String, nullable=True)

    diagnosis = Column(Text, nullable=True)
    risk_assessment = Column(Text, nullable=True)
    recommended_tests = Column(Text, nullable=True)       # stored as JSON string
    treatment_suggestions = Column(Text, nullable=True)   # stored as JSON string
    precautions = Column(Text, nullable=True)              # stored as JSON string
    disclaimer = Column(Text, nullable=True)

    # Risk Stratification fields
    risk_tier = Column(String, nullable=True)    # "low" | "moderate" | "high"
    risk_score = Column(Float, nullable=True)    # 0-100 numeric confidence in the tier

    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="reports")


class ReportEntity(Base):
    """
    A single extracted entity (condition/test/treatment) linked to a report.
    Powers the Knowledge Graph — one row per entity mention.
    """
    __tablename__ = "report_entities"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("reports.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)

    entity_type = Column(String, nullable=False)   # "condition" | "test" | "treatment"
    entity_name = Column(String, nullable=False, index=True)

    created_at = Column(DateTime, default=datetime.utcnow)