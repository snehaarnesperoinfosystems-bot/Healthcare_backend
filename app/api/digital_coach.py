from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc
import logging

from app.database import get_db
from app.models.care_hub_models import Patient, Report

router = APIRouter(prefix="/digital-coach", tags=["Digital Coach"])
logger = logging.getLogger("digital_coach")

class CoachRequest(BaseModel):
    patient_id: int

def _generate_dynamic_advice(diagnosis: str, risk_assessment: str, recommended_tests: str,
                              treatment_suggestions: str, risk_tier: str, age, sex: str) -> dict:
    """
    Yeh function patient ki PURI report (diagnosis, risk assessment, recommended tests,
    treatment suggestions) ko study karke uske liye personalized
    Diet Plan, Sleep Hygiene, aur Exercise advice generate karta hai.
    """
    # Default advice (agar koi specific condition na mile)
    advice = {
        "diet": "Maintain a balanced diet rich in vegetables and lean proteins. Stay hydrated.",
        "sleep": "Aim for 7-8 hours of consistent sleep nightly.",
        "exercise": "30 minutes of moderate cardio daily is recommended."
    }

    # Puri report ka text ek jagah combine karo taaki poora context mile,
    # sirf diagnosis field tak seemit na rahe
    full_text = " ".join(filter(None, [
        diagnosis, risk_assessment, recommended_tests, treatment_suggestions
    ])).lower()

    diet_notes = []
    sleep_notes = []
    exercise_notes = []

    # 1. Diabetes / Blood Sugar
    if any(k in full_text for k in ["diabetes", "blood sugar", "hba1c", "glucose"]):
        diet_notes.append("Low glycemic index foods (whole grains, beans, leafy greens). Strictly avoid refined sugar and sugary drinks.")
        exercise_notes.append("30 mins brisk walking after meals helps control blood sugar spikes.")

    # 2. Hypertension / Cardiac / Cholesterol
    if any(k in full_text for k in ["hypertension", "blood pressure", "cardiac", "heart"]):
        diet_notes.append("Low sodium (DASH-style diet). Avoid pickles, processed and fried food. Eat potassium-rich foods like bananas and spinach.")
        exercise_notes.append("Moderate aerobic exercise like walking or swimming; avoid heavy weightlifting without clearance.")

    if any(k in full_text for k in ["cholesterol", "lipid", "ldl", "triglyceride"]):
        diet_notes.append("Reduce saturated and trans fats. Increase omega-3s (fish, walnuts, flaxseed) and soluble fiber (oats, beans).")
        exercise_notes.append("40 minutes of moderate-to-vigorous cardio, 4-5 times a week, supports healthy lipid levels.")

    # 3. Thyroid conditions
    if any(k in full_text for k in ["thyroid", "hypothyroid", "hyperthyroid", "tsh", " t3", " t4"]):
        diet_notes.append("Include iodine-rich foods (dairy, eggs) and selenium (nuts, seeds); avoid excess raw cruciferous vegetables.")
        sleep_notes.append("Thyroid imbalances often cause fatigue — prioritize 8+ hours of quality, uninterrupted sleep.")
        exercise_notes.append("Start with light to moderate activity; avoid overexertion until thyroid levels stabilize.")

    # 4. Anemia / Iron deficiency
    if any(k in full_text for k in ["anemia", "iron deficiency", "ferritin", "hemoglobin"]):
        diet_notes.append("Increase iron-rich foods (spinach, red meat, lentils) paired with vitamin C to boost absorption.")
        exercise_notes.append("Keep exercise light to moderate until iron levels normalize, to avoid excessive fatigue.")

    # 5. Kidney-related concerns
    if any(k in full_text for k in ["kidney", "creatinine", "renal"]):
        diet_notes.append("Moderate protein and sodium intake; stay well hydrated unless advised otherwise by your doctor.")

    # 6. Age-based adjustment (Elderly care)
    # FIX: Age ko safely integer me convert kar rahe hain taaki string se compare karne par error na aaye
    try:
        age_int = int(age) if age is not None else 0
    except (ValueError, TypeError):
        age_int = 0

    if age_int > 60:
        exercise_notes.append("Focus on light yoga and balance exercises to reduce fall risk.")

    # 7. Overall risk tier
    if risk_tier and risk_tier.lower() == "high":
        sleep_notes.append("High risk detected — practice deep breathing or meditation before bed to manage stress.")
        diet_notes.append("Strict dietary discipline is critical given the current risk level.")

    # Agar koi specific condition detect hui, to us par based advice use karo;
    # warna default advice hi rahegi
    if diet_notes:
        advice["diet"] = " ".join(diet_notes)
    if sleep_notes:
        advice["sleep"] = " ".join(sleep_notes)
    if exercise_notes:
        advice["exercise"] = " ".join(exercise_notes)

    return advice


@router.post("/generate-plan")
async def generate_coach_plan(request: CoachRequest, db: Session = Depends(get_db)):
    """
    Fetches patient profile and latest report to generate personalized 
    Digital Health Coach advice.
    """
    # 1. Patient exist karta hai ya nahi check karo
    patient = db.query(Patient).filter(Patient.id == request.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # 2. Patient ka latest report fetch karo
    latest_report = (
        db.query(Report)
        .filter(Report.patient_id == request.patient_id)
        .order_by(desc(Report.created_at))
        .first()
    )

    # Agar koi report nahi hai toh generic advice do
    if not latest_report:
        logger.info(f"[Digital Coach] No reports found for patient_id={request.patient_id}. Giving generic advice.")
        advice_data = _generate_dynamic_advice("", "", "", "", "Unknown", patient.age, patient.sex)
        return {
            "patient_id": request.patient_id,
            "patient_name": patient.name,
            "message": "No reports found. Showing generic advice.",
            **advice_data
        }

    # 3. Report ki puri details ke basis par dynamic advice generate karo
    personalized_advice = _generate_dynamic_advice(
        diagnosis=latest_report.diagnosis,
        risk_assessment=latest_report.risk_assessment,
        recommended_tests=latest_report.recommended_tests,
        treatment_suggestions=latest_report.treatment_suggestions,
        risk_tier=latest_report.risk_tier,
        age=patient.age,
        sex=patient.sex
    )

    logger.info(f"[Digital Coach] Generated advice for patient_id={request.patient_id}")

    return {
        "patient_id": request.patient_id,
        "patient_name": patient.name,
        "diagnosis": latest_report.diagnosis,
        **personalized_advice
    }