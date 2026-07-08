import json
import logging
import ollama

logger = logging.getLogger("entity_extraction")

ENTITY_PROMPT = """Extract medical entities from this report data as JSON.

Return ONLY this JSON structure, nothing else:

{{
  "conditions": ["condition name 1", "condition name 2"],
  "tests": ["test name 1", "test name 2"],
  "treatments": ["treatment name 1", "treatment name 2"]
}}

Rules:
- conditions: diagnoses or medical conditions mentioned (short names only, e.g. "Hyperthyroidism" not a full sentence)
- tests: lab tests or investigations mentioned or recommended (short names, e.g. "TSH", "CBC", "Free T4")
- treatments: medications or treatment types mentioned (short names, e.g. "Levothyroxine", "Beta-blockers")
- Use short canonical names, not full sentences
- If a category has nothing, return an empty list
- Deduplicate similar entities (e.g. "high TSH" and "TSH" -> just "TSH")

Report data:
Diagnosis: {diagnosis}
Recommended tests: {tests}
Treatment suggestions: {treatments}
"""

def _extract_json_object(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"): raw = raw[4:]
        raw = raw.strip()
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or end < start: raise ValueError("No JSON object found")
    return raw[start:end + 1]

def extract_entities(diagnosis: str, tests: list, treatments: list) -> dict:
    try:
        response = ollama.chat(
            model="medgemma:latest",
            messages=[{"role": "user", "content": ENTITY_PROMPT.format(diagnosis=diagnosis or "None", tests=", ".join(tests) if tests else "None", treatments=", ".join(treatments) if treatments else "None")}],
            format="json",
            options={"temperature": 0, "num_predict": 256}
        )
        raw = response["message"]["content"]
        parsed = json.loads(_extract_json_object(raw))
        return {
            "conditions": [c.strip() for c in parsed.get("conditions", []) if c and c.strip()],
            "tests": [t.strip() for t in parsed.get("tests", []) if t and t.strip()],
            "treatments": [t.strip() for t in parsed.get("treatments", []) if t and t.strip()],
        }
    except Exception as e:
        logger.error(f"[KG] Entity extraction FAILED: {e}")
        return {"conditions": [], "tests": [], "treatments": []}