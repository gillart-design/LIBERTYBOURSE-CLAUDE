import json
from typing import Any, Optional
import redis.asyncio as aioredis
from app.core.config import settings

redis_client: aioredis.Redis = aioredis.from_url(
    settings.REDIS_URL,
    encoding="utf-8",
    decode_responses=True,
)


async def cache_get(key: str) -> Optional[Any]:
    val = await redis_client.get(key)
    if val is None:
        return None
    try:
        return json.loads(val)
    except (json.JSONDecodeError, TypeError):
        return val


async def cache_set(key: str, value: Any, ttl: int = 60) -> None:
    await redis_client.setex(key, ttl, json.dumps(value, default=str))


async def cache_delete(key: str) -> None:
    await redis_client.delete(key)


async def publish(channel: str, message: Any) -> None:
    await redis_client.publish(channel, json.dumps(message, default=str))
