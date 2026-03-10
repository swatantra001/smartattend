from fastapi import APIRouter
from app.services.face_service import face_service
from app.services.scene_service import scene_service
from app.database import fetch_one

router = APIRouter()


@router.get("/health")
async def health_check():
    db_ok = False
    try:
        await fetch_one("SELECT 1")
        db_ok = True
    except Exception:
        pass

    return {
        "success": True,
        "status": "healthy" if db_ok else "degraded",
        "components": {
            "database": db_ok,
            "face_model": face_service._app is not None,
            "scene_model": scene_service._model is not None,
        }
    }