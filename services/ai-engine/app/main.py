import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import init_db
from app.services.face_service import face_service
from app.services.scene_service import scene_service
from app.routers import enroll, verify, upload, health

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────────────
    logger.info("Starting SmartAttend AI Engine...")

    await init_db()
    logger.info("✅ Database connected")

    await face_service.initialize()
    logger.info("✅ InsightFace model loaded")

    await scene_service.initialize()
    logger.info("✅ Scene verification model loaded")

    logger.info("🚀 AI Engine ready")
    yield

    # ── Shutdown ─────────────────────────────────────────────────────────────
    logger.info("Shutting down AI Engine...")


app = FastAPI(
    title="SmartAttend AI Engine",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url=None,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.API_SERVICE_URL],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# ── INTERNAL AUTH MIDDLEWARE ──────────────────────────────────────────────────
@app.middleware("http")
async def verify_internal_token(request: Request, call_next):
    """
    AI engine is internal-only.
    All requests must carry the shared internal secret header.
    """
    if request.url.path in ("/health", "/docs"):
        return await call_next(request)

    token = request.headers.get("X-Internal-Token")
    if token != settings.INTERNAL_SECRET:
        return JSONResponse(
            status_code=403,
            content={"success": False, "error": "Forbidden"}
        )
    return await call_next(request)


# ── GLOBAL EXCEPTION HANDLER ──────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception", path=request.url.path, error=str(exc))
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": "Internal server error"}
    )


# ── ROUTERS ───────────────────────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(enroll.router)
app.include_router(verify.router)
app.include_router(upload.router)