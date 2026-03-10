import redis.asyncio as aioredis
from app.config import settings

_redis: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis


# ── Key helpers (mirror Node.js RedisKeys) ────────────────────────────────────
def scene_baseline_key(session_id: str) -> str:
    return f"scene:baseline:{session_id}"


def scene_count_key(session_id: str) -> str:
    return f"scene:count:{session_id}"