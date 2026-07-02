from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import desc
import json
import os
import logging

from app.database import get_db, SessionLocal
from app.models.care_hub_models import Patient, Report, ReportEntity
from app.services.risk_engine import calculate_risk
from app.services.pdf_service import extract_text_from_pdf
from app.services.ai_service import analyze_medical_text, analyze_medical_image
from app.services.entity_extraction import extract_entities

logger = logging.getLogger("care_hub")
logging.basicConfig(level=logging.INFO)

router = APIRouter(
    prefix="/care-hub",
    tags=["Care Hub"]
)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def _extract_entities_background(report_id: int, patient_id: int, diagnosis: str, tests: list, treatments: list):
    """
    Runs AFTER the HTTP response is already sent. Opens its own DB session
    since the request's session is closed by then.
    """
    logger.info(f"[KG] Starting background extraction for report_id={report_id}")
    db = SessionLocal()
    try:
        entities = extract_entities(diagnosis=diagnosis, tests=tests, treatments=treatments)
        logger.info(f"[KG] Extracted entities for report_id={report_id}: {entities}")

        rows = []
        for cond in entities["conditions"]:
            rows.append(ReportEntity(
                report_id=report_id, patient_id=patient_id,
                entity_type="condition", entity_name=cond
            ))
        for test in entities["tests"]:
            rows.append(ReportEntity(
                report_id=report_id, patient_id=patient_id,
                entity_type="test", entity_name=test
            ))
        for tx in entities["treatments"]:
            rows.append(ReportEntity(
                report_id=report_id, patient_id=patient_id,
                entity_type="treatment", entity_name=tx
            ))

        if rows:
            db.add_all(rows)
            db.commit()
            logger.info(f"[KG] Saved {len(rows)} entity rows for report_id={report_id}")
        else:
            logger.warning(f"[KG] No entities found for report_id={report_id}")
    except Exception as e:
        logger.error(f"[KG] Background extraction FAILED for report_id={report_id}: {e}", exc_info=True)
    finally:
        db.close()


def _save_analysis_to_db(filename: str, analysis: dict, db: Session, background_tasks: BackgroundTasks) -> dict:
    """Shared logic: takes an analysis dict and persists it under a patient."""
    summary = analysis.get("patient_summary") or {}
    patient_name = summary.get("name") or "Unknown Patient"

    patient = db.query(Patient).filter(Patient.name == patient_name).first()
    if not patient:
        patient = Patient(
            name=patient_name,
            age=summary.get("age"),
            sex=summary.get("sex"),
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)

    risk = calculate_risk(
        diagnosis=analysis.get("diagnosis", ""),
        risk_assessment=analysis.get("risk_assessment", "")
    )

    report = Report(
        patient_id=patient.id,
        filename=filename,
        sample_date=summary.get("sample_date"),
        diagnosis=analysis.get("diagnosis"),
        risk_assessment=analysis.get("risk_assessment"),
        recommended_tests=json.dumps(analysis.get("recommended_tests", [])),
        treatment_suggestions=json.dumps(analysis.get("treatment_suggestions", [])),
        precautions=json.dumps(analysis.get("precautions", [])),
        disclaimer=analysis.get("disclaimer"),
        risk_tier=risk["tier"],
        risk_score=risk["score"],
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    logger.info(f"[KG] Scheduling background extraction for report_id={report.id}")
    background_tasks.add_task(
        _extract_entities_background,
        report.id,
        patient.id,
        analysis.get("diagnosis", ""),
        analysis.get("recommended_tests", []),
        analysis.get("treatment_suggestions", []),
    )

    return {
        "status": "success",
        "patient_id": patient.id,
        "report_id": report.id,
        "risk_tier": risk["tier"],
        "risk_score": risk["score"],
        "analysis": analysis,
    }


@router.post("/save")
async def upload_and_save_report(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Upload a PDF/JPG/PNG report — analyzes and saves it immediately.
    Knowledge Graph entity extraction runs in the background afterward.
    """
    allowed_extensions = [".pdf", ".jpg", ".jpeg", ".png"]
    ext = os.path.splitext(file.filename)[1].lower()

    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail="Only PDF, JPG, JPEG and PNG files are allowed."
        )

    contents = await file.read()
    file_path = os.path.join(UPLOAD_FOLDER, file.filename)

    try:
        with open(file_path, "wb") as buffer:
            buffer.write(contents)

        if ext == ".pdf":
            text = extract_text_from_pdf(file_path)
            if not text.strip():
                raise HTTPException(status_code=422, detail="Could not extract text from PDF.")
            analysis = analyze_medical_text(text)
        else:
            analysis = analyze_medical_image(contents)

        result = _save_analysis_to_db(file.filename, analysis, db, background_tasks)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

    return result


@router.post("/save-json")
async def save_existing_analysis(
    payload: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Save an already-analyzed report (manual JSON body) — kept for testing."""
    filename = payload.get("filename")
    analysis = payload.get("analysis", {})

    if not filename or not analysis:
        raise HTTPException(status_code=400, detail="filename and analysis are required")

    return _save_analysis_to_db(filename, analysis, db, background_tasks)


@router.get("/patients")
async def list_patients(db: Session = Depends(get_db)):
    """List all patients with their report count and latest risk tier."""
    patients = db.query(Patient).order_by(desc(Patient.created_at)).all()

    result = []
    for p in patients:
        latest_report = (
            db.query(Report)
            .filter(Report.patient_id == p.id)
            .order_by(desc(Report.created_at))
            .first()
        )
        result.append({
            "id": p.id,
            "name": p.name,
            "age": p.age,
            "sex": p.sex,
            "report_count": len(p.reports),
            "latest_risk_tier": latest_report.risk_tier if latest_report else None,
            "latest_risk_score": latest_report.risk_score if latest_report else None,
            "last_updated": latest_report.created_at.isoformat() if latest_report else None,
        })
    return {"patients": result}


@router.get("/patients/{patient_id}/reports")
async def get_patient_reports(patient_id: int, db: Session = Depends(get_db)):
    """Get full report history for one patient, newest first."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    reports = (
        db.query(Report)
        .filter(Report.patient_id == patient_id)
        .order_by(desc(Report.created_at))
        .all()
    )

    return {
        "patient": {
            "id": patient.id,
            "name": patient.name,
            "age": patient.age,
            "sex": patient.sex,
        },
        "reports": [
            {
                "id": r.id,
                "filename": r.filename,
                "sample_date": r.sample_date,
                "diagnosis": r.diagnosis,
                "risk_assessment": r.risk_assessment,
                "recommended_tests": json.loads(r.recommended_tests or "[]"),
                "treatment_suggestions": json.loads(r.treatment_suggestions or "[]"),
                "precautions": json.loads(r.precautions or "[]"),
                "disclaimer": r.disclaimer,
                "risk_tier": r.risk_tier,
                "risk_score": r.risk_score,
                "created_at": r.created_at.isoformat(),
            }
            for r in reports
        ]
    }


@router.delete("/patients/{patient_id}")
async def delete_patient(patient_id: int, db: Session = Depends(get_db)):
    """Delete a patient and all their reports."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    db.delete(patient)
    db.commit()
    return {"status": "success", "message": f"Patient {patient_id} deleted"}