from fastapi import FastAPI

app = FastAPI(
    title="Healthcare AI Report Analyzer",
    description="AI-powered Healthcare Report Analyzer using FastAPI and MedGemma",
    version="1.0.0"
)


@app.get("/")
async def home():
    return {
        "status": "success",
        "message": "Healthcare AI Backend is Running 🚀"
    }
