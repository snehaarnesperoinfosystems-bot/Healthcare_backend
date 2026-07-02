from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

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
        if "hi" in msg or "hello" in msg:
            return {"reply": "Hello Doctor! Please select a patient first, so I can analyze their medical records and assist you."}
        return {"reply": "Please select a patient from the list above so I can provide context-specific advice."}

    # Patient ke context mein se Diagnosis aur Treatments nikalna
    diagnosis_part = "Not specified"
    treatment_part = "Not specified"
    
    if "Diagnoses:" in ctx:
        diagnosis_part = ctx.split("Diagnoses: ")[1].split(", Treatments:")[0].strip()
    if "Treatments:" in ctx:
        treatment_part = ctx.split("Treatments: ")[1].strip()

    # Smart Rule-based Responses (Doctor ke questions ke hisaab se)
    if "hi" in msg or "hello" in msg or "hey" in msg:
        return {"reply": f"Hello Doctor! I have loaded the patient's profile. How can I assist you regarding their conditions ({diagnosis_part})?"}
        
    elif "concern" in msg or "issue" in msg or "problem" in msg or "condition" in msg or "abnormal" in msg:
        return {"reply": f"Based on the lab reports, the primary health concerns for this patient are: {diagnosis_part}. I recommend close monitoring and a follow-up test to track the progression."}
        
    elif "treatment" in msg or "medicine" in msg or "medication" in msg or "drug" in msg:
        return {"reply": f"The currently suggested treatment plans include: {treatment_part}. Please ensure the patient adheres strictly to the dosage and lifestyle modifications."}
        
    elif "diet" in msg or "food" in msg or "eat" in msg:
        return {"reply": "Given the current conditions, a balanced diet low in sodium and processed sugars is recommended. Incorporating leafy greens and lean proteins will support the treatment."}
        
    elif "risk" in msg or "danger" in msg or "severe" in msg:
        return {"reply": f"The risk level is determined by the combination of {diagnosis_part}. Without proper management, there is a risk of complications. Regular monitoring is crucial."}
        
    else:
        # Default smart reply for any other question using the context
        return {"reply": f"Regarding your question: '{request.message}', based on the patient's profile showing issues like ({diagnosis_part}) and treatments like ({treatment_part}), I advise a comprehensive clinical review. Would you like me to elaborate on any specific condition or treatment?"}