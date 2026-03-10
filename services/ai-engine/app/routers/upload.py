import structlog
from fastapi import APIRouter, HTTPException
from app.schemas import UploadProofRequest, UploadProofResponse
from app.utils.image import base64_to_numpy, resize_for_display
from app.utils.s3 import upload_image_bytes
import cv2

logger = structlog.get_logger()
router = APIRouter()


@router.post("/upload-proof", response_model=UploadProofResponse)
async def upload_proof(request: UploadProofRequest):
    """Upload device reset proof image to S3."""
    try:
        img = base64_to_numpy(request.image_base64)
        img = resize_for_display(img, max_dim=1024)

        success, buf = cv2.imencode(
            ".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 85]
        )
        if not success:
            raise ValueError("Encode failed")

        url = upload_image_bytes(
            buf.tobytes(),
            folder=f"proofs/{request.user_id}",
            expiry_days=90,
        )

        return UploadProofResponse(success=True, url=url)

    except Exception as e:
        logger.error("Proof upload failed", error=str(e))
        raise HTTPException(status_code=422, detail=str(e))