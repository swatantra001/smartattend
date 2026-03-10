import boto3
import uuid
import io
import structlog
from botocore.exceptions import ClientError
from app.config import settings

logger = structlog.get_logger()

_s3_client = None


def get_s3():
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
        )
    return _s3_client


def upload_image_bytes(
    image_bytes: bytes,
    folder: str,
    content_type: str = "image/jpeg",
    expiry_days: int = 30,
) -> str | None:
    """
    Upload image bytes to S3.
    Returns public URL or None on failure.
    Sets expiry tag for lifecycle policy.
    """
    if not settings.S3_BUCKET:
        logger.warning("S3 not configured — skipping upload")
        return None

    try:
        key = f"{folder}/{uuid.uuid4()}.jpg"
        s3 = get_s3()

        s3.put_object(
            Bucket=settings.S3_BUCKET,
            Key=key,
            Body=image_bytes,
            ContentType=content_type,
            ServerSideEncryption="AES256",
            Tagging=f"expiry-days={expiry_days}",
        )

        url = f"https://{settings.S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com/{key}"
        return url

    except ClientError as e:
        logger.error("S3 upload failed", error=str(e))
        return None


def generate_presigned_url(key: str, expiry_seconds: int = 3600) -> str | None:
    """Generate a pre-signed URL for private S3 objects."""
    if not settings.S3_BUCKET:
        return None
    try:
        s3 = get_s3()
        url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.S3_BUCKET, "Key": key},
            ExpiresIn=expiry_seconds,
        )
        return url
    except ClientError as e:
        logger.error("Presigned URL failed", error=str(e))
        return None