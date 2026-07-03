from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json

router = APIRouter(prefix="/symptom-checker", tags=["Symptom Checker"])

class SymptomRequest(BaseModel):
    message: str
    context: str = ""  # Frontend se patient ka data yahan aayega

@router.post("/chat")
async def symptom_checker_chat(request: SymptomRequest):
    msg = request.message.lower()
    ctx = request.context
    
    # Agar context nahi hai (jab tak patient select nahi karte)
    if not ctx:
        return {
            "reply": "Hello Doctor! Please select a patient first, so I can analyze their medical records and assist you.",
            "follow_up": None, 
            "lab_table": None
        }

    # Patient ke context mein se Diagnosis aur Treatments nikalna
    diagnosis_part = "Not specified"
    treatment_part = "Not specified"
    
    if "Diagnoses:" in ctx:
        diagnosis_part = ctx.split("Diagnoses: ")[1].split(", Treatments:")[0].strip()
    if "Treatments:" in ctx:
        treatment_part = ctx.split("Treatments: ")[1].strip()

    # Agar diagnosis bahut lamba hai toh usko short karo
    if len(diagnosis_part) > 100:
        diagnosis_part = diagnosis_part[:100].rsplit(' ', 1)[0] + "..."
        
    if len(treatment_part) > 100:
        treatment_part = treatment_part[:100].rsplit(' ', 1)[0] + "..."

    # Default response variables
    reply = ""
    follow_up = None
    lab_table = None

    # 🟢 Smart Rule-based Responses (Doctor ke questions ke hisaab se)
    if "hi" in msg or "hello" in msg or "hey" in msg:
        reply = f"Hello Doctor! I have loaded the profile. How can I assist you regarding **{diagnosis_part}**?"
        
    elif "concern" in msg or "issue" in msg or "problem" in msg or "condition" in msg or "abnormal" in msg:
        reply = f"Based on the lab reports, the primary health concerns are: **{diagnosis_part}**.\n\nI recommend close monitoring and a follow-up test."
        follow_up = "1 Month"
        
        # Example: Agar diagnosis me anemia ya hemoglobin hai, toh table dikhao
        if "anemia" in diagnosis_part.lower() or "hemoglobin" in diagnosis_part.lower():
            lab_table = [
                {"test": "Hemoglobin", "value": "11.2 g/dL", "range": "12.0 - 14.0", "status": "low"},
                {"test": "ESR", "value": "65 mm", "range": "0 - 16", "status": "high"}
            ]
            
    elif "treatment" in msg or "medicine" in msg or "medication" in msg or "drug" in msg:
        reply = f"The currently suggested treatment plans include: **{treatment_part}**.\n\nPlease ensure the patient adheres strictly to the dosage."
        
    elif "diet" in msg or "food" in msg or "eat" in msg:
        reply = "Given the current conditions, a balanced diet low in sodium and processed sugars is recommended. Incorporating leafy greens and lean proteins will support the treatment."
        
    elif "risk" in msg or "danger" in msg or "severe" in msg:
        reply = "Based on the lab results, there are notable abnormalities that elevate the patient's risk profile. Without proper management, there is a risk of complications."
        follow_up = "2 Weeks"
        
    elif "summarize" in msg or "summary" in msg or "profile" in msg:
        reply = f"**Patient Summary:**\n- **Diagnosis:** {diagnosis_part}\n- **Ongoing Treatment:** {treatment_part}\n- **Status:** Needs monitoring."
        
    else:
        # Default smart reply for any other question
        reply = f"Regarding your question: '{request.message}', based on the patient's profile showing issues like **{diagnosis_part}**, I advise a comprehensive clinical review. Would you like me to elaborate?"

    return {
        "reply": reply,
        "follow_up": follow_up,
        "lab_table": lab_table
    }