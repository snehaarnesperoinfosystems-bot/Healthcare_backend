from fastapi import APIRouter, UploadFile, File, HTTPException
import fitz  # PyMuPDF
from PIL import Image
import pytesseract
import io
import re
 
# ✅ Router define karein
router = APIRouter(prefix="/report", tags=["Report Analyzer"])
 
# ✅ Windows ke liye Tesseract Path
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
 
 
# ✅ CRITICAL / LIFE-THREATENING KEYWORDS LIST
CRITICAL_KEYWORDS = [
    # Cancer - Terminal stages
    "terminal cancer", "terminal illness", "terminal phase",
    "stage 4", "stage iv", "stage-4", "stage four",
    "metastatic", "metastasis", "metastases", "metastatic spread",
    "widespread metastasis", "diffuse metastasis",
    "pancreatic adenocarcinoma", "glioblastoma", "glioblastoma multiforme",
    "inoperable cancer", "unresectable cancer", "unresectable tumor",
    "relapsed refractory", "refractory leukemia",
 
    # End-stage organ diseases
    "end-stage renal", "end stage renal", "end-stage kidney", "esrd",
    "end-stage liver", "end stage liver", "end-stage cirrhosis",
    "end-stage copd", "end stage copd", "end-stage heart failure",
    "end stage heart failure", "refractory heart failure",
    "decompensated cirrhosis", "liver failure with encephalopathy",
 
    # Cardiac emergencies
    "cardiac arrest", "ventricular fibrillation", "ventricular tachycardia",
    "cardiogenic shock", "acute mi with shock", "massive myocardial infarction",
    "ejection fraction 5", "ejection fraction 10", "ejection fraction 15",
    "ef 5%", "ef 10%", "ef 15%", "lvef 10", "lvef 15",
    "severe aortic stenosis with symptoms", "cardiac tamponade",
 
    # Neurological emergencies
    "intracerebral hemorrhage with midline shift",
    "massive stroke", "hemorrhagic stroke with coma",
    "subarachnoid hemorrhage", "brain herniation",
    "brain death", "glasgow coma scale 3", "gcs 3",
    "comatose", "deep coma", "persistent vegetative state",
 
    # Sepsis & Organ Failure
    "septic shock", "sepsis with organ dysfunction",
    "multiple organ failure", "multi-organ failure", "multiorgan failure",
    "mods", "acute respiratory distress syndrome", "ards",
    "acute liver failure", "fulminant hepatitis",
    "hepatorenal syndrome", "disseminated intravascular coagulation", "dic",
 
    # Prognosis indicators
    "poor prognosis", "grave prognosis", "guarded prognosis",
    "weeks to live", "days to live", "months to live",
    "life expectancy", "imminent death", "approaching end of life",
    "fatal if untreated", "rapidly fatal",
 
    # Care directives
    "palliative care only", "comfort care only", "hospice care",
    "do not resuscitate", "dnr", "do not intubate", "dni",
    "end-of-life care", "terminal sedation",
 
    # Other critical
    "acute respiratory failure", "respiratory failure requiring ventilation",
    "necrotizing fasciitis", "gas gangrene",
    "acute pancreatitis with organ failure",
    "dissecting aortic aneurysm", "ruptured aortic aneurysm",
    "acute abdomen peritonitis", "severe sepsis",
]
 
# Compile regex for faster matching (word boundaries)
CRITICAL_PATTERN = re.compile(
    r'(?i)\b(' + '|'.join(re.escape(k) for k in CRITICAL_KEYWORDS) + r')\b'
)
 
 
def check_critical_conditions(text: str):
    """
    Scan extracted text for critical / life-threatening keywords.
    Returns list of matched keywords (empty list = safe).
    """
    if not text:
        return []
   
    matches = CRITICAL_PATTERN.findall(text.lower())
    # Deduplicate while preserving order
    seen = set()
    unique_matches = []
    for m in matches:
        m_lower = m.lower()
        if m_lower not in seen:
            seen.add(m_lower)
            unique_matches.append(m)
    return unique_matches
 
 
def extract_text_from_pdf(file_bytes: bytes):
    """Fastest way to extract text from PDFs"""
    text = ""
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        for page in doc:
            text += page.get_text()
        doc.close()
        if text.strip():
            return text
    except Exception as e:
        print("PyMuPDF failed, falling back to OCR:", e)
 
    print("No digital text found. Running OCR (This will take time)...")
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        for page in doc:
            pix = page.get_pixmap(dpi=150)
            img_data = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_data))
            text += pytesseract.image_to_string(img)
        doc.close()
    except Exception as e:
        print("OCR failed:", e)
    return text
 
 
# ✅ Helper: Critical condition response builder
def build_critical_response(critical_keywords: list, filename: str):
    return {
        "status": "critical_condition_detected",
        "message": "⚠️ URGENT: This report indicates a potentially serious or life-threatening medical condition.",
        "advice": (
            "This case requires immediate professional medical evaluation and cannot be analyzed through this AI tool. "
            "Please consult a qualified doctor or specialist IMMEDIATELY."
        ),
        "critical_keywords_found": critical_keywords,
        "filename": filename,
        "helpline": "🚑 Emergency: 112 | Please visit your nearest hospital or specialist.",
        "disclaimer": "This AI tool is designed for non-critical report analysis only. Serious cases need human medical expertise."
    }
 
 
# ✅ Main Analysis Endpoint
@router.post("/analyze")
async def analyze_report(file: UploadFile = File(...)):
    try:
        # 1. Read file
        file_bytes = await file.read()
       
        # 2. Extract text
        extracted_text = extract_text_from_pdf(file_bytes)
       
        if not extracted_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract any text from the document.")
 
        # 3. 🔴 CRITICAL CONDITION CHECK — Yahan serious case detect hota hai
        critical_findings = check_critical_conditions(extracted_text)
        if critical_findings:
            print(f"⚠️ Critical condition detected in {file.filename}: {critical_findings}")
            return build_critical_response(critical_findings, file.filename)
 
        # 4. Normal AI/LLM analysis yahan aayega
        # analysis = await run_llm_analysis(extracted_text)
       
        return {
            "status": "success",
            "filename": file.filename,
            "extracted_text_preview": extracted_text[:500],
            "message": "Text extracted successfully! Connect your LLM here for full analysis."
        }
 
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))