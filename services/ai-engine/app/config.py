import os

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Server
    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Internal auth — must match API service env
    INTERNAL_SECRET: str = os.getenv("INTERNAL_SECRET")
    API_SERVICE_URL: str = "http://api:4000"

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL")

    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL")

    # AWS S3
    S3_BUCKET: str = "smartattend-media"
    AWS_ACCESS_KEY_ID: str = os.getenv("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY: str = os.getenv("AWS_SECRET_ACCESS_KEY")
    AWS_REGION: str = "eu-north-1"

    # Face recognition
    INSIGHTFACE_MODEL: str = "buffalo_l"        # buffalo_l = best accuracy
    INSIGHTFACE_CTX_ID: int = -1                # -1 = CPU, 0 = first GPU
    FACE_MATCH_THRESHOLD: float = 0.65
    FACE_MIN_DETECTION_SCORE: float = 0.85      # reject low-confidence detections
    MAX_ENROLLMENT_PHOTOS: int = 7

    # Scene verification
    SCENE_MODEL: str = "mobilenet_v3_large"
    SCENE_MATCH_THRESHOLD: float = 0.60
    SCENE_MIN_SAMPLES: int = 5                  # min verified students before scene check active
    SCENE_FEATURE_DIM: int = 960                # MobileNetV3-Large penultimate layer

    # Model cache directory
    MODEL_DIR: str = "/app/models"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()