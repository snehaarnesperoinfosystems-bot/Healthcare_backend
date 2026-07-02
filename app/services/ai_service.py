import ollama
import base64
import json


ANALYSIS_PROMPT = """You are a medical report analyzer. Respond ONLY with this JSON, no extra text:

{
  "patient_summary": {"name": "", "age": "", "sex": "", "sample_date": ""},
  "diagnosis": "",
  "risk_assessment": "",
  "recommended_tests": [""],
  "treatment_suggestions": [""],
  "precautions": [""],
  "disclaimer": "For informational purposes only. Consult a qualified doctor."
}

Fill every field. For diagnosis: summarize ALL abnormal findings, not just the first one.
For recommended_tests and treatment_suggestions: provide clinical recommendations even if
not explicitly listed in the report. Use null only for truly missing patient_summary fields."""


def _parse_response(raw: str) -> dict:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    try:
        return json.loads(raw.strip())
    except json.JSONDecodeError:
        return {"summary": raw}


def analyze_medical_text(text: str) -> dict:
    response = ollama.chat(
        model="medgemma:latest",
        messages=[
            {
                "role": "user",
                "content": f"{ANALYSIS_PROMPT}\n\nMedical Report:\n{text}"
            }
        ],
        options={
            "num_ctx": 4096,
            "num_predict": 1024,
            "temperature": 0,
        }
    )
    return _parse_response(response["message"]["content"])


def analyze_medical_image(image_bytes: bytes) -> dict:
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    response = ollama.chat(
        model="medgemma:latest",   # ✅ back to medgemma — works for both text and images
        messages=[
            {
                "role": "user",
                "content": ANALYSIS_PROMPT,
                "images": [image_b64]
            }
        ],
        options={
            "num_ctx": 4096,
            "num_predict": 1024,
            "temperature": 0,
        }
    )
    return _parse_response(response["message"]["content"])