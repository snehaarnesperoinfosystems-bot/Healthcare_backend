from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/digital-coach", tags=["Digital Coach"])

class CoachRequest(BaseModel):
    patient_id: int

@router.post("/generate-plan")
async def generate_coach_plan(request: CoachRequest):
    # Abhi ke liye mock response, baad mein aap isme LLM integrate kar sakte hain
    # jaise aapne Decision Intelligence mein kiya hai
    return {
        "diet": "Low sodium, high protein diet recommended.",
        "sleep": "Aim for 7-8 hours, limit screen time before bed.",
        "exercise": "30 minutes of moderate cardio daily."
    }