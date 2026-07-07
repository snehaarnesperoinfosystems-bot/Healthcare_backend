from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import desc
import json
import os
import logging
import hashlib
import asyncio  # 🟢 Added for background timer

from app.database import get_db, SessionLocal
from app.models.care_hub_models import Patient, Report, ReportEntity
from app.services.risk_engine import calculate_risk
from app.services.pdf_service import extract_text_from_pdf
from app.services.ai_service import analyze_medical_text, analyze_medical_image
from app.services.entity_extraction import extract_entities
from starlette.concurrency import run_in_threadpool

logger = logging.getLogger("care_hub")
logging.basicConfig(level=logging.INFO)

router = APIRouter(
    prefix="/care-hub",
    tags=["Care Hub"]
)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


# 🟢 NAYA FUNCTION: 1 hour (3600 seconds) baad report ko DB se delete karna
async def _delete_report_after_1hr(report_id: int):
    """Waits for 1 hour, then deletes the report and its entities."""
    try:
        # 1 hour ka wait (3600 seconds)
        await asyncio.sleep(3600)
        
        db = SessionLocal()
        try:
            # Pehle Knowledge Graph entities delete karo
            db.query(ReportEntity).filter(ReportEntity.report_id == report_id).delete()
            
            # Phir report delete karo
            report = db.query(Report).filter(Report.id == report_id).first()
            if report:
                patient_id = report.patient_id
                db.delete(report)
                db.commit()
                logger.info(f"[Auto-Delete] Report ID {report_id} automatically deleted after 1 hour.")
                
                # Agar patient ki koi aur report nahi bach hai, toh patient ko bhi delete kar do (Optional but clean)
                remaining_reports = db.query(Report).filter(Report.patient_id == patient_id).count()
                if remaining_reports == 0:
                    patient = db.query(Patient).filter(Patient.id == patient_id).first()
                    if patient:
                        db.delete(patient)
                        db.commit()
                        logger.info(f"[Auto-Delete] Patient ID {patient_id} deleted (no reports left).")
            else:
                db.rollback()
        except Exception as e:
            db.rollback()
            logger.error(f"[Auto-Delete] Error deleting report {report_id}: {e}")
        finally:
            db.close()
    except asyncio.CancelledError:
        # Agar server restart ho toh timer cancel ho jayega
        pass


def _extract_entities_background(report_id: int, patient_id: int, diagnosis: str, tests: list, treatments: list):
    logger.info(f"[KG] Starting background extraction for report_id={report_id}")
    db = SessionLocal()
    try:
        entities = extract_entities(diagnosis=diagnosis, tests=tests, treatments=treatments)
        logger.info(f"[KG] Extracted entities for report_id={report_id}: {entities}")

        rows = []
        for cond in entities["conditions"]:
            rows.append(ReportEntity(report_id=report_id, patient_id=patient_id, entity_type="condition", entity_name=cond))
        for test in entities["tests"]:
            rows.append(ReportEntity(report_id=report_id, patient_id=patient_id, entity_type="test", entity_name=test))
        for tx in entities["treatments"]:
            rows.append(ReportEntity(report_id=report_id, patient_id=patient_id, entity_type="treatment", entity_name=tx))

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


def _save_analysis_to_db(filename: str, file_hash: str, analysis: dict, db: Session, background_tasks: BackgroundTasks) -> dict:
    summary = analysis.get("patient_summary") or {}
    patient_name = summary.get("name") or "Unknown Patient"

    patient = db.query(Patient).filter(Patient.name == patient_name).first()
    if not patient:
        patient = Patient(name=patient_name, age=summary.get("age"), sex=summary.get("sex"))
        db.add(patient)
        db.commit()
        db.refresh(patient)

    risk = calculate_risk(diagnosis=analysis.get("diagnosis", ""), risk_assessment=analysis.get("risk_assessment", ""))

    report = Report(
        patient_id=patient.id,
        filename=filename,
        file_hash=file_hash,
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
        report.id, patient.id,
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
    allowed_extensions = [".pdf", ".jpg", ".jpeg", ".png"]
    ext = os.path.splitext(file.filename)[1].lower()

    if ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Only PDF, JPG, JPEG and PNG files are allowed.")

    contents = await file.read()
    file_hash = hashlib.sha256(contents).hexdigest()
    file_path = os.path.join(UPLOAD_FOLDER, file.filename)

    try:
        with open(file_path, "wb") as buffer:
            buffer.write(contents)

        if ext == ".pdf":
            text = await run_in_threadpool(extract_text_from_pdf, file_path)
            if not text.strip():
                raise HTTPException(status_code=422, detail="Could not extract text from PDF.")
            analysis = await run_in_threadpool(analyze_medical_text, text)
        else:
            analysis = await run_in_threadpool(analyze_medical_image, contents)

        # Duplicate Check
        existing_report = db.query(Report).filter(Report.file_hash == file_hash).first()
        if existing_report:
            logger.info(f"Duplicate file detected (Hash: {file_hash}). Skipping DB save.")
            return {
                "status": "duplicate_skipped",
                "message": "This report was already saved earlier.",
                "patient_id": existing_report.patient_id,
                "report_id": existing_report.id,
                "risk_tier": existing_report.risk_tier,
                "risk_score": existing_report.risk_score,
                "analysis": analysis,
            }

        result = await run_in_threadpool(_save_analysis_to_db, file.filename, file_hash, analysis, db, background_tasks)
        
        # 🟢 NAYA CODE: Report save hone ke 1 hour baad delete hone ke liye timer start karna
        if result.get("status") == "success":
            asyncio.create_task(_delete_report_after_1hr(result["report_id"]))

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
    filename = payload.get("filename")
    analysis = payload.get("analysis", {})
    if not filename or not analysis:
        raise HTTPException(status_code=400, detail="filename and analysis are required")
    return _save_analysis_to_db(filename, "", analysis, db, background_tasks)


@router.get("/patients")
async def list_patients(db: Session = Depends(get_db)):
    patients = db.query(Patient).order_by(desc(Patient.created_at)).all()
    result = []
    for p in patients:
        latest_report = db.query(Report).filter(Report.patient_id == p.id).order_by(desc(Report.created_at)).first()
        result.append({
            "id": p.id, "name": p.name, "age": p.age, "sex": p.sex,
            "report_count": len(p.reports),
            "latest_risk_tier": latest_report.risk_tier if latest_report else None,
            "latest_risk_score": latest_report.risk_score if latest_report else None,
            "last_updated": latest_report.created_at.isoformat() if latest_report else None,
        })
    return {"patients": result}


@router.get("/patients/{patient_id}/reports")
async def get_patient_reports(patient_id: int, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    reports = db.query(Report).filter(Report.patient_id == patient_id).order_by(desc(Report.created_at)).all()
    return {
        "patient": {"id": patient.id, "name": patient.name, "age": patient.age, "sex": patient.sex},
        "reports": [
            {
                "id": r.id, "filename": r.filename, "sample_date": r.sample_date,
                "diagnosis": r.diagnosis, "risk_assessment": r.risk_assessment,
                "recommended_tests": json.loads(r.recommended_tests or "[]"),
                "treatment_suggestions": json.loads(r.treatment_suggestions or "[]"),
                "precautions": json.loads(r.precautions or "[]"),
                "disclaimer": r.disclaimer, "risk_tier": r.risk_tier, "risk_score": r.risk_score,
                "created_at": r.created_at.isoformat(),
            } for r in reports
        ]
    }


@router.delete("/patients/{patient_id}")
async def delete_patient(patient_id: int, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    db.delete(patient)
    db.commit()
    return {"status": "success", "message": f"Patient {patient_id} deleted"}