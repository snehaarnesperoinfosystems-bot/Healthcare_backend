# app/api/wellness.py
from fastapi import APIRouter
from pydantic import BaseModel
from app.services.wellness_service import wellness_service

router = APIRouter()

class WellnessRequest(BaseModel):
    message: str
    context: str = ""  # This will hold the chat history

@router.post("/api/wellness/analyze")
async def analyze_wellness(request: WellnessRequest):
    """Endpoint for Mental Wellness Assistant with memory"""
    return wellness_service.analyze_mood(request.message, request.context)