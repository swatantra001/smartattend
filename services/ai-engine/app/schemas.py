from pydantic import BaseModel, Field
from typing import Optional


# ── ENROLLMENT ────────────────────────────────────────────────────────────────
class EnrollRequest(BaseModel):
    student_id: str
    photos_base64: list[str] = Field(
        min_length=3,
        max_length=7,
        description="3-7 base64 encoded JPEG photos"
    )


class EnrollResponse(BaseModel):
    success: bool
    embedding: list[float]          # 512-dim stored in DB
    quality_score: float
    thumbnail_url: Optional[str]
    photos_accepted: int
    photos_rejected: int
    message: str


# ── VERIFICATION ──────────────────────────────────────────────────────────────
class VerifyRequest(BaseModel):
    student_id: str
    session_id: str
    face_frame_base64: str          # single frame captured after liveness
    stored_embedding: list[float]   # fetched from DB by Node.js API


class VerifyResponse(BaseModel):
    success: bool
    face_score: float               # cosine similarity 0-1
    scene_score: float              # background similarity 0-1
    face_passed: bool
    scene_passed: bool
    det_score: float                # face detection confidence
    message: str


# ── PROOF UPLOAD ──────────────────────────────────────────────────────────────
class UploadProofRequest(BaseModel):
    user_id: str
    image_base64: str


class UploadProofResponse(BaseModel):
    success: bool
    url: Optional[str]