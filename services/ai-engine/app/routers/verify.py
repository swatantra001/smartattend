import structlog
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.schemas import VerifyRequest, VerifyResponse
from app.services.face_service import face_service
from app.services.scene_service import scene_service
from app.utils.image import (
    base64_to_numpy,
    remove_face_region,
    numpy_to_pil,
)
from app.utils.s3 import upload_image_bytes
from app.config import settings
import cv2

logger = structlog.get_logger()
router = APIRouter()

@router.post("/verify", response_model=VerifyResponse)
async def verify_attendance(request: VerifyRequest):
    """
    Two-step verification endpoint:
    Step 1 — Face recognition: compare submitted frame to stored embedding
    Step 2 — Scene verification: Crowd Consensus Clustering
    """
    logger.info("=" * 60)
    logger.info(f"🚀 INCOMING VERIFICATION REQUEST: {request.student_id}")
    logger.info("=" * 60)

    # ── Decode submitted frame ────────────────────────────────────────────────
    try:
        img_bgr = base64_to_numpy(request.face_frame_base64)
        logger.debug("[STEP 0] Successfully decoded Base64 image payload.")
    except Exception as e:
        logger.error(f"[STEP 0] Failed to decode image: {e}")
        raise HTTPException(status_code=422, detail=f"Invalid image: {e}")

    # ── STEP 1: Face recognition ──────────────────────────────────────────────
    logger.info("[STEP 1] Starting Face Extraction & Recognition...")
    # embedding, det_score, bbox = await face_service.extract_embedding(img_bgr)
    # 🟢 NEW: Route the image through the Anti-Spoofing Gatekeeper! TODO: added
    is_live, det_score, bbox, embedding = await face_service.validate_liveness_frame(img_bgr)

    if not is_live:
        logger.warning(f"❌ [STEP 1 FAILED] Liveness check failed or no face detected.")
        raise HTTPException(
            status_code=403, # 403 Forbidden for spoofing!
            detail="Spoofing detected or invalid face. Please use a real live camera feed."
        )

    if embedding is None or det_score < settings.FACE_MIN_DETECTION_SCORE:
        logger.warning(f"❌ [STEP 1 FAILED] No valid face detected. Score: {det_score}")
        raise HTTPException(
            status_code=422,
            detail=(
                f"No face detected (confidence: {det_score:.2f}). "
                "Ensure good lighting and face the camera directly."
            )
        )

    # Compare against stored embedding from DB
    stored = np.array(request.stored_embedding, dtype=np.float32)

    # Re-normalize stored embedding (safety)
    norm = np.linalg.norm(stored)
    if norm > 0:
        stored = stored / norm

    face_score = face_service.cosine_similarity(embedding, stored)
    face_passed = face_score >= settings.FACE_MATCH_THRESHOLD

    logger.info(
        f"{'✅' if face_passed else '❌'} [STEP 1 COMPLETE] Face Match Result",
        score=round(face_score, 4),
        threshold=settings.FACE_MATCH_THRESHOLD,
        passed=face_passed
    )

    # ── STEP 2: Scene verification (Crowd Consensus) ──────────────────────────
    logger.info("-" * 60)
    logger.info("🔍 [STEP 2] ENTERING SCENE / BACKGROUND VERIFICATION")
    logger.info("-" * 60)
    
    scene_score = 1.0
    scene_passed = True

    try:
        # Remove face region before extracting scene features
        if bbox is not None and len(bbox) == 4:
            logger.debug("Applying face blackout mask for pure background extraction...")
            img_no_face = remove_face_region(img_bgr, bbox)
        else:
            img_no_face = img_bgr

        pil_img = numpy_to_pil(img_no_face)
        scene_vector = await scene_service.extract_features(pil_img)
        logger.debug("Successfully extracted 960-dim MobileNetV3 scene features.")

        if face_passed:
            logger.debug("Student face is valid. Adding to Crowd Consensus Matrix.")
            
            # Save their specific vector for the crowd consensus matrix
            await scene_service.save_student_vector(
                request.session_id, request.student_id, scene_vector
            )

            # Check if they are ALREADY an outlier against the currently established crowd
            crowd_data = await scene_service.evaluate_crowd(request.session_id)
            
            if request.student_id in crowd_data.get("outliers", []):
                scene_score = crowd_data.get("scores", {}).get(request.student_id, 0.0)
                scene_passed = False
                logger.warning(f"Student {request.student_id} rejected instantly. Background is a mathematical outlier.")
            else:
                scene_score = crowd_data.get("scores", {}).get(request.student_id, 1.0)
                scene_passed = True

    except Exception as e:
        logger.error(f"🚨 [STEP 2 ERROR] Scene verification crashed: {str(e)}", exc_info=True)
        # Fail open for scene so we don't break attendance due to a background bug
        scene_score = 1.0
        scene_passed = True

    logger.info(f"{'✅' if scene_passed else '⚠️'} [STEP 2 COMPLETE] Scene verification concluded.")

    # ── Save verification frame to S3 for audit (30-day retention) ───────────
    try:
        success, buf = cv2.imencode(
            ".jpg", img_bgr, [cv2.IMWRITE_JPEG_QUALITY, 80]
        )
        if success:
            upload_image_bytes(
                buf.tobytes(),
                folder=f"verifications/{request.session_id}/{request.student_id}",
                expiry_days=30,
            )
            logger.debug("Verification audit frame saved to S3.")
    except Exception as e:
        logger.warning(f"Audit frame upload failed: {str(e)}")

    logger.info("=" * 60)
    logger.info(
        f"🏁 FINAL VERIFICATION DECISION FOR {request.student_id}",
        face_score=round(face_score, 4),
        scene_score=round(scene_score, 4),
        overall_status="SUCCESS" if (face_passed and scene_passed) else ("SUSPICIOUS" if face_passed else "REJECTED")
    )
    logger.info("=" * 60)

    return VerifyResponse(
        success=True,
        face_score=round(float(face_score), 4),
        scene_score=round(float(scene_score), 4),
        face_passed=bool(face_passed),
        scene_passed=bool(scene_passed),
        det_score=round(float(det_score), 4),
        message="Verification complete",
    )


# =================================================================
# NEW ROUTE: Called by Node.js Periodic Worker
# =================================================================
class RecheckRequest(BaseModel):
    session_id: str

@router.post("/scene/recheck")
async def recheck_scene_consensus(request: RecheckRequest):
    """
    Called periodically by Node.js Backend. 
    Returns students who have been retroactively identified as outliers.
    """
    try:
        logger.info(f"Running periodic background consensus for session {request.session_id}")
        result = await scene_service.evaluate_crowd(request.session_id)
        return result
    except Exception as e:
        logger.error(f"Fatal error in /scene/recheck: {str(e)}", exc_info=True)
        # Return empty safe object so Node.js doesn't crash
        return {"outliers": [], "scores": {}}