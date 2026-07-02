from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware  # ✅ Added CORS support

from app.api.report import router as report_router
from app.api.care_hub import router as care_hub_router
from app.api.decision_intelligence import router as decision_router
from app.api.knowledge_graph import router as knowledge_graph_router
from app.database import engine, Base
import app.models.care_hub_models  # noqa: F401 - registers models before create_all

# ✅ Naye routers import kiye
from app.api.symptom_checker import router as symptom_checker_router
from app.api.digital_coach import router as digital_coach_router

# ✅ Create database tables on startup (SQLite file: healthcare.db)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Healthcare AI Report Analyzer",
    version="1.2.0",
    description="Upload medical reports (PDF/Image) and get AI-powered analysis."
)

# ✅ CORS middleware — adjust origins for production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(report_router)
app.include_router(care_hub_router)
app.include_router(decision_router)
app.include_router(knowledge_graph_router)
app.include_router(symptom_checker_router)
app.include_router(digital_coach_router)


@app.get("/")
async def home():
    return {
        "message": "Healthcare AI Backend Running 🚀",
        "docs": "/docs"
    }