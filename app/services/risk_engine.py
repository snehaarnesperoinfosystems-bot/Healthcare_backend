"""
Risk Stratification Engine.

Classifies a report's risk into Low / Moderate / High tiers by scanning
the AI-generated diagnosis and risk_assessment text for clinical severity
keywords. No extra model call needed — pure text analysis on what the
analyzer already returned.
"""

import re


HIGH_RISK_KEYWORDS = [
    "severe", "critical", "life-threatening", "life threatening", "urgent",
    "emergency", "acute", "thyroid storm", "sepsis", "hemorrhage",
    "malignant", "cancer", "stroke", "cardiac arrest", "failure",
    "immediately", "high risk",
]

MODERATE_RISK_KEYWORDS = [
    "elevated", "moderate", "abnormal", "warrant", "further investigation",
    "monitor", "follow-up", "follow up", "irregular", "borderline",
    "mild", "concern", "should be evaluated",
]

LOW_RISK_KEYWORDS = [
    "normal", "within range", "no significant", "healthy", "stable",
    "low risk", "unremarkable", "no concerns",
]


def _count_matches(text: str, keywords: list[str]) -> int:
    text_lower = text.lower()
    return sum(1 for kw in keywords if kw in text_lower)


def calculate_risk(diagnosis: str, risk_assessment: str) -> dict:
    """
    Returns {"tier": "low"|"moderate"|"high", "score": float 0-100}

    Score reflects how strongly the matched keywords skew toward that tier,
    not a clinical probability — it's a triage signal, not a diagnosis.
    """
    combined_text = f"{diagnosis or ''} {risk_assessment or ''}"

    high_hits = _count_matches(combined_text, HIGH_RISK_KEYWORDS)
    moderate_hits = _count_matches(combined_text, MODERATE_RISK_KEYWORDS)
    low_hits = _count_matches(combined_text, LOW_RISK_KEYWORDS)

    total_hits = high_hits + moderate_hits + low_hits

    if total_hits == 0:
        # No clear signal — default to moderate so it doesn't get silently ignored
        return {"tier": "moderate", "score": 50.0}

    if high_hits > 0:
        tier = "high"
        score = min(100.0, 60 + (high_hits * 12))
    elif moderate_hits >= low_hits:
        tier = "moderate"
        score = min(89.0, 40 + (moderate_hits * 8))
    else:
        tier = "low"
        score = max(5.0, 30 - (low_hits * 6))

    return {"tier": tier, "score": round(score, 1)}