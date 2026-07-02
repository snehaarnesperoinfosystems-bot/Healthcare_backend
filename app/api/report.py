from fastapi import APIRouter, UploadFile, File, HTTPException
import fitz  # PyMuPDF
from PIL import Image
import pytesseract
import io

# ✅ Router define karein (Jo main.py import kar raha hai)
router = APIRouter(prefix="/report", tags=["Report Analyzer"])

# ✅ Windows ke liye Tesseract Path (Agar aapka install location alag hai toh yahan change karein)
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'


def extract_text_from_pdf(file_bytes: bytes):
    """Fastest way to extract text from PDFs"""
    text = ""
    
    # 1. Try extracting text directly using PyMuPDF (Super fast for digital PDFs)
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        for page in doc:
            text += page.get_text()
        doc.close()
        
        # Agar text mil gaya, toh turant return kar do (OCR skip - Saves 90% time)
        if text.strip():
            return text
    except Exception as e:
        print("PyMuPDF failed, falling back to OCR:", e)

    # 2. Agar PDF scanned image hai (Text empty hai), tab hi slow OCR use karo
    print("No digital text found. Running OCR (This will take time)...")
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        for page in doc:
            # Convert PDF page to high-res image
            pix = page.get_pixmap(dpi=150)
            img_data = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_data))
            
            # Run OCR on the image
            text += pytesseract.image_to_string(img)
        doc.close()
    except Exception as e:
        print("OCR failed:", e)
        
    return text


# ✅ Aapka Report Analysis Endpoint (AI call wala logic yahan aayega)
@router.post("/analyze")
async def analyze_report(file: UploadFile = File(...)):
    try:
        # 1. File read karein
        file_bytes = await file.read()
        
        # 2. Fast Text Extraction call karein
        extracted_text = extract_text_from_pdf(file_bytes)
        
        if not extracted_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract any text from the document.")

        # 3. Yahan aapki AI/LLM wali logic aayegi jo extracted_text ko analyze karegi
        # Jaise: analysis = await run_llm_analysis(extracted_text)
        
        # Abhi ke liye hum dummy response return kar rahe hain
        return {
            "filename": file.filename,
            "extracted_text_preview": extracted_text[:500], # Pehle 500 characters dikhane ke liye
            "message": "Text extracted successfully! Connect your LLM here for full analysis."
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))