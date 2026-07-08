from fastapi import APIRouter
from pydantic import BaseModel
from app.services.wellness_service import wellness_service
from starlette.concurrency import run_in_threadpool

router = APIRouter()

class WellnessRequest(BaseModel):
    message: str
    context: str = ""

@router.post("/api/wellness/analyze")
async def analyze_wellness(request: WellnessRequest):
    """Endpoint for Mental Wellness Assistant with memory"""
    return await run_in_threadpool(wellness_service.analyze_mood, request.message, request.context)