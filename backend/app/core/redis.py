import json
from typing import Any, Optional
import redis.asyncio as aioredis
from app.core.config import settings
import structlog

log = structlog.get_logger()

redis_client: aioredis.Redis = aioredis.from_url(
    settings.REDIS_URL,
    encoding="utf-8",
    decode_responses=True,
)

_redis_available = True


async def cache_get(key: str) -> Optional[Any]:
    if not _redis_available:
        return None
    try:
        val = await redis_client.get(key)
        if val is None:
            return None
        try:
            return json.loads(val)
        except (json.JSONDecodeError, TypeError):
            return val
    except Exception as e:
        log.warning("cache_get_failed", error=str(e))
        return None


async def cache_set(key: str, value: Any, ttl: int = 60) -> None:
    if not _redis_available:
        return
    try:
        await redis_client.setex(key, ttl, json.dumps(value, default=str))
    except Exception as e:
        log.warning("cache_set_failed", error=str(e))


async def cache_delete(key: str) -> None:
    if not _redis_available:
        return
    try:
        await redis_client.delete(key)
    except Exception as e:
        log.warning("cache_delete_failed", error=str(e))


async def publish(channel: str, message: Any) -> None:
    if not _redis_available:
        return
    try:
        await redis_client.publish(channel, json.dumps(message, default=str))
    except Exception as e:
        log.warning("publish_failed", channel=channel, error=str(e))
