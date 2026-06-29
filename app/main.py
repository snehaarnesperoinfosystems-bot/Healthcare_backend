from fastapi import FastAPI
from app.api.report import router as report_router

app = FastAPI(
    title="Healthcare AI Report Analyzer",
    version="1.0.0"
)

app.include_router(report_router)

@app.get("/")
async def home():
    return {
        "message": "Healthcare AI Backend Running 🚀"
    }