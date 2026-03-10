from fastapi import FastAPI, Request
from typing import Any
import uvicorn

app = FastAPI(title="SmartAttend AI Engine (MOCK)")

@app.get("/health")
def health():
    return {"status": "healthy", "mode": "mock"}

@app.post("/verify")
async def verify(request: Request):
    # Accept any JSON body
    return {
        "success": True,
        "face_score": 0.95,
        "liveness_score": 0.92,
        "scene_score": 0.88,
        "is_match": True,
        "is_live": True,
        "is_scene_valid": True,
        "message": "Verification successful (mock)"
    }

@app.post("/enroll")
async def enroll(request: Request):
    return {
        "success": True,
        "embedding": [0.1] * 512,
        "quality_score": 0.95,
        "thumbnail_url": None,
        "message": "Enrolled successfully (mock)"
    }

@app.post("/scene-baseline")
async def scene_baseline(request: Request):
    return {"success": True, "baseline": [0.1] * 512}

@app.post("/upload-proof")
async def upload_proof(request: Request):
    return {"success": True, "url": "https://placeholder.com/proof.jpg"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)