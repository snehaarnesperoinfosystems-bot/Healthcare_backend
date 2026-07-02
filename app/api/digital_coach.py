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

def _generate_dynamic_advice(diagnosis: str, risk_tier: str, age: int, sex: str) -> dict:
    """
    Yeh function patient ke diagnosis aur profile ko check karke 
    custom Diet, Sleep aur Exercise advice generate karta hai.
    """
    # Default advice (agar koi specific diagnosis na ho)
    advice = {
        "diet": "Maintain a balanced diet rich in vegetables and lean proteins. Stay hydrated.",
        "sleep": "Aim for 7-8 hours of consistent sleep nightly.",
        "exercise": "30 minutes of moderate cardio daily is recommended."
    }

    diag = (diagnosis or "").lower()

    # 1. Agar Diabetes ya Blood Sugar hai
    if "diabetes" in diag or "blood sugar" in diag:
        advice["diet"] = "Low glycemic index foods (whole grains, beans). Strictly avoid refined sugar."
        advice["exercise"] = "30 mins brisk walking post-meals is highly recommended."
        
    # 2. Agar Hypertension ya Blood Pressure hai
    elif "hypertension" in diag or "blood pressure" in diag:
        advice["diet"] = "Low sodium (DASH diet). Avoid pickles and fried food. Eat potassium-rich foods."
        advice["exercise"] = "Moderate aerobic exercise like walking or swimming. Avoid heavy weightlifting."
        
    # 3. Agar Cholesterol / Lipid issue hai
    elif "cholesterol" in diag or "lipid" in diag:
        advice["diet"] = "Reduce saturated fats. Increase omega-3s (fish, walnuts) and soluble fiber (oats)."
        advice["exercise"] = "40 minutes of moderate-to-vigorous cardio 4-5 times a week."

    # 4. Agar patient ka age zyada hai (Elderly care)
    if age and age > 60:
        advice["exercise"] = "Focus on light yoga and balance exercises to prevent falls. " + advice["exercise"]

    # 5. Agar Risk High hai
    if risk_tier and risk_tier.lower() == "high":
        advice["sleep"] = "High stress levels detected. Practice deep breathing before bed. " + advice["sleep"]

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
        advice_data = _generate_dynamic_advice("", "Unknown", patient.age, patient.sex)
        return {
            "patient_id": request.patient_id,
            "patient_name": patient.name,
            "message": "No reports found. Showing generic advice.",
            **advice_data
        }

    # 3. Report ke basis par dynamic advice generate karo
    personalized_advice = _generate_dynamic_advice(
        diagnosis=latest_report.diagnosis,
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