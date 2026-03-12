"""
Price Scheduler — polls market data providers every N seconds,
publishes updates to Redis pub/sub channels consumed by WebSocket endpoints.
"""
import asyncio
from typing import Set
import structlog

from app.core.config import settings
from app.core.redis import redis_client, publish
from app.services.market_data.provider import market_data_manager

log = structlog.get_logger()

# Default symbols to always track
DEFAULT_SYMBOLS: Set[str] = {
    "AAPL", "MSFT", "NVDA", "TSLA", "GOOGL", "AMZN", "META",
    "MC.PA", "TTE.PA", "AIR.PA", "SPY", "QQQ", "BTC-USD", "ETH-USD",
}


class PriceScheduler:
    def __init__(self):
        self._task: asyncio.Task | None = None
        self._running = False
        self._subscribed: Set[str] = set(DEFAULT_SYMBOLS)

    async def start(self):
        self._running = True
        self._task = asyncio.create_task(self._loop())
        log.info("scheduler.started", interval=settings.PRICE_REFRESH_INTERVAL)

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        log.info("scheduler.stopped")

    def subscribe(self, symbol: str):
        self._subscribed.add(symbol.upper())

    def unsubscribe(self, symbol: str):
        sym = symbol.upper()
        if sym not in DEFAULT_SYMBOLS:
            self._subscribed.discard(sym)

    async def _loop(self):
        while self._running:
            try:
                symbols = list(self._subscribed)
                # Fetch in batches of 20
                for i in range(0, len(symbols), 20):
                    batch = symbols[i:i+20]
                    quotes = await market_data_manager.get_quotes(batch)
                    for q in quotes:
                        # Publish to per-symbol channel
                        await publish(f"prices:{q['symbol']}", q)
                    # Publish batch update to general channel
                    if quotes:
                        await publish("prices:batch", quotes)
            except Exception as e:
                log.error("scheduler.loop_error", error=str(e))
            await asyncio.sleep(settings.PRICE_REFRESH_INTERVAL)
