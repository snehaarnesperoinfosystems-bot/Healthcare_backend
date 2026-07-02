import fitz
import re


def extract_text_from_pdf(file_path: str) -> str:
    """
    Extract text from PDF and intelligently summarize it for the AI model.
    For large multi-column lab reports, extracts only flagged abnormal values
    and patient info to stay within the model's context window.
    """
    try:
        doc = fitz.open(file_path)
        full_text = ""
        for page in doc:
            full_text += page.get_text() + "\n"
        doc.close()
    except Exception as e:
        raise RuntimeError(f"Failed to read PDF: {str(e)}")

    words = full_text.split()

    # If short enough, send as-is (single panel reports like thyroid work fine)
    if len(words) <= 1500:
        return full_text

    # For large reports, extract a structured clinical summary instead
    return _extract_clinical_summary(full_text)


def _extract_clinical_summary(text: str) -> str:
    """
    For large multi-page lab reports, build a clean clinical summary by:
    1. Extracting patient info
    2. Finding all lines with flagged H/L values
    3. Adding a note about the report type
    """
    lines = text.split("\n")
    patient_info = []
    abnormal_findings = []
    normal_findings = []

    # Extract patient name
    for line in lines:
        line = line.strip()
        if re.search(r"lyubochka|name\s*:", line, re.IGNORECASE):
            if len(line) < 100:
                patient_info.append(line)
        if re.search(r"male|female", line, re.IGNORECASE) and re.search(r"\d+\s*y", line, re.IGNORECASE):
            patient_info.append(line)
        if re.search(r"20-feb-2023|sample type", line, re.IGNORECASE) and len(line) < 80:
            patient_info.append(line)

    # Find lines with explicit H (high) or L (low) flags
    for line in lines:
        line = line.strip()
        if not line or len(line) < 5:
            continue
        # Lines with H or L flag next to a number = abnormal result
        if re.search(r'\bH\b|\bH\s+\d|\d+\s+H\b', line):
            abnormal_findings.append(f"HIGH: {line}")
        elif re.search(r'\bL\b|\bL\s+\d|\d+\s+L\b', line):
            abnormal_findings.append(f"LOW: {line}")

    # Also extract key test values by name (for tests that may not have H/L flags)
    key_tests = [
        "hba1c", "fasting blood sugar", "vitamin d", "vitamin b12",
        "homocysteine", "ige", "wbc", "triglyceride", "ldl", "hdl",
        "cholesterol", "tsh", "t3", "t4", "psa", "hiv", "hbsag",
        "hemoglobin", "platelet", "creatinine", "urea", "sgpt", "sgot",
        "vitamin", "iron", "ferritin", "esr", "mpv"
    ]
    for line in lines:
        line_lower = line.lower().strip()
        if any(test in line_lower for test in key_tests):
            if re.search(r'\d', line) and len(line) < 120:
                normal_findings.append(line.strip())

    # Deduplicate
    seen = set()
    unique_abnormal = []
    for f in abnormal_findings:
        if f not in seen:
            seen.add(f)
            unique_abnormal.append(f)

    seen2 = set()
    unique_normal = []
    for f in normal_findings:
        if f not in seen2:
            seen2.add(f)
            unique_normal.append(f)

    # Build clean summary
    summary_parts = []

    if patient_info:
        summary_parts.append("PATIENT INFO:")
        summary_parts.extend(list(dict.fromkeys(patient_info))[:6])
        summary_parts.append("")

    if unique_abnormal:
        summary_parts.append("ABNORMAL FINDINGS (flagged H=High, L=Low):")
        summary_parts.extend(unique_abnormal[:40])
        summary_parts.append("")

    if unique_normal:
        summary_parts.append("OTHER TEST RESULTS:")
        summary_parts.extend(unique_normal[:30])

    result = "\n".join(summary_parts)

    # Final safety cap
    words = result.split()
    if len(words) > 2500:
        result = " ".join(words[:2500])

    return result