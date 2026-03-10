import structlog
import numpy as np
import cv2
from fastapi import APIRouter, HTTPException

from app.schemas import EnrollRequest, EnrollResponse
from app.services.face_service import face_service
from app.utils.image import base64_to_numpy, resize_for_display, numpy_to_pil
from app.utils.s3 import upload_image_bytes
from app.config import settings

logger = structlog.get_logger()
router = APIRouter()


@router.post("/enroll", response_model=EnrollResponse)
async def enroll_face(request: EnrollRequest):
    """
    Face enrollment endpoint.

    Accepts 3-7 photos, extracts ArcFace embeddings,
    validates quality, returns averaged embedding to store in DB.
    """
    logger.info("Face enrollment started", student_id=request.student_id)

    # ── Decode all images ────────────────────────────────────────────────────
    images: list[np.ndarray] = []
    decode_errors = 0

    for i, b64 in enumerate(request.photos_base64):
        try:
            img = base64_to_numpy(b64)
            images.append(img)
        except Exception as e:
            logger.warning(f"Photo {i} decode failed", error=str(e))
            decode_errors += 1

    if len(images) < 3:
        raise HTTPException(
            status_code=422,
            detail="At least 3 valid photos required for enrollment"
        )

    # ── Extract embeddings ───────────────────────────────────────────────────
    results = await face_service.extract_embeddings_batch(images)

    valid_embeddings: list[np.ndarray] = []
    valid_det_scores: list[float] = []
    rejected = 0

    for i, (embedding, det_score) in enumerate(results):
        if embedding is None:
            logger.warning(f"No face detected in photo {i}", score=det_score)
            rejected += 1
            continue
        if det_score < settings.FACE_MIN_DETECTION_SCORE:
            logger.warning(f"Low det_score in photo {i}", score=det_score)
            rejected += 1
            continue
        valid_embeddings.append(embedding)
        valid_det_scores.append(det_score)

    if len(valid_embeddings) < 3:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Only {len(valid_embeddings)} photos had detectable faces. "
                "Please retake photos in good lighting with face clearly visible."
            )
        )

    # ── Compute quality score ────────────────────────────────────────────────
    quality_score = face_service.enrollment_quality(
        valid_embeddings, valid_det_scores
    )

    if quality_score < 0.75:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Enrollment quality too low ({quality_score:.2f}). "
                "Take photos facing camera directly in good lighting."
            )
        )

    # ── Average embeddings ───────────────────────────────────────────────────
    avg_embedding = face_service.average_embeddings(valid_embeddings)

    # ── Generate thumbnail from best photo ───────────────────────────────────
    thumbnail_url: str | None = None
    best_idx = int(np.argmax(valid_det_scores))
    best_img = images[best_idx]

    # Resize to thumbnail
    thumb = resize_for_display(best_img, max_dim=320)
    success, buf = cv2.imencode(
        ".jpg", thumb, [cv2.IMWRITE_JPEG_QUALITY, 85]
    )
    if success:
        thumbnail_url = upload_image_bytes(
            buf.tobytes(),
            folder=f"enrollments/{request.student_id}",
            expiry_days=9999  # enrollment photos kept permanently
        )

    logger.info(
        "Face enrollment complete",
        student_id=request.student_id,
        quality=quality_score,
        accepted=len(valid_embeddings),
        rejected=rejected,
    )

    return EnrollResponse(
        success=True,
        embedding=avg_embedding.tolist(),
        quality_score=quality_score,
        thumbnail_url=thumbnail_url,
        photos_accepted=len(valid_embeddings),
        photos_rejected=rejected + decode_errors,
        message="Face enrolled successfully"
    )