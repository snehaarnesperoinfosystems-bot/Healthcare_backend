from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
import json
import re
import ollama

from app.database import get_db
from app.models.care_hub_models import Patient, Report

router = APIRouter(
    prefix="/decision-intelligence",
    tags=["Decision Intelligence"]
)


DECISION_PROMPT = """You are a clinical decision support assistant.

Below is a patient's report history (most recent first). Synthesize ONE combined
recommendation across all reports — don't just repeat each report individually.

Respond ONLY with this JSON object and nothing else. No markdown, no explanation, no comments:

{{
  "overall_risk_trend": "improving",
  "key_concerns": ["concern 1", "concern 2"],
  "priority_actions": ["action 1", "action 2"],
  "summary": "one paragraph summary"
}}

overall_risk_trend must be exactly one of: improving, stable, worsening, insufficient_data

Patient Report History:
{history}
"""


def _extract_json_object(raw: str) -> str:
    """
    Pull out the first {...} block from the model's raw output.
    Handles cases where the model adds markdown fences, preamble text,
    or trailing commentary around the JSON.
    """
    raw = raw.strip()

    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    # Find the first '{' and matching last '}' — handles stray text around it
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise json.JSONDecodeError("No JSON object found", raw, 0)

    return raw[start:end + 1]


def _parse_json(raw: str) -> dict:
    candidate = _extract_json_object(raw)
    return json.loads(candidate)


@router.post("/patients/{patient_id}")
async def get_decision_summary(patient_id: int, db: Session = Depends(get_db)):
    """
    Combine a patient's full report history into one decision-support summary.
    Requires at least 1 saved report (works best with 2+).
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    reports = (
        db.query(Report)
        .filter(Report.patient_id == patient_id)
        .order_by(desc(Report.created_at))
        .all()
    )

    if not reports:
        raise HTTPException(status_code=400, detail="No reports found for this patient")

    history_lines = []
    for r in reports:
        history_lines.append(
            f"- [{r.created_at.strftime('%Y-%m-%d')}] "
            f"Risk: {r.risk_tier or 'unknown'} | "
            f"Diagnosis: {r.diagnosis or 'N/A'} | "
            f"Risk Assessment: {r.risk_assessment or 'N/A'}"
        )
    history_text = "\n".join(history_lines)

    raw_output = None
    try:
        response = ollama.chat(
            model="medgemma:latest",
            messages=[
                {
                    "role": "user",
                    "content": DECISION_PROMPT.format(history=history_text)
                }
            ],
            options={"temperature": 0, "num_predict": 512}
        )
        raw_output = response["message"]["content"]
        decision = _parse_json(raw_output)
    except json.JSONDecodeError:
        # ✅ Graceful fallback — never 500, just return the raw text
        decision = {
            "summary": raw_output or "The model did not return a usable response.",
            "overall_risk_trend": "insufficient_data",
            "key_concerns": [],
            "priority_actions": [],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Decision synthesis failed: {str(e)}")

    return {
        "patient": {"id": patient.id, "name": patient.name},
        "report_count": len(reports),
        "decision": decision,
    }