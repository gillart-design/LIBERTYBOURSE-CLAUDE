"""
TradeFlow — FastAPI Backend
Entry point: registers all routers, middleware, lifespan events.
"""
from contextlib import asynccontextmanager
import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.core.config import settings
from app.core.database import engine, Base
from app.core.redis import redis_client
from app.api.v1 import auth, users, portfolios, orders, market, watchlists, alerts, journal, backtesting
from app.services.market_data.scheduler import PriceScheduler

log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    log.info("tradeflow.startup", mode="DEMO" if settings.DEMO_MODE else "LIVE")

    # Create DB tables (Alembic handles migrations in prod)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Connect Redis (optional)
    try:
        await redis_client.ping()
        log.info("redis.connected")
    except Exception as e:
        log.warning("redis.connection_failed", error=str(e))

    # Start price scheduler (background polling / websocket feeds)
    scheduler = PriceScheduler()
    await scheduler.start()
    app.state.scheduler = scheduler

    yield

    # Shutdown
    await scheduler.stop()
    try:
        await redis_client.aclose()
    except:
        pass
    await engine.dispose()
    log.info("tradeflow.shutdown")


app = FastAPI(
    title="TradeFlow API",
    version="1.0.0",
    description="Professional paper trading simulator with real-time market data",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── Middleware ──────────────────────────────────────────────────
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS_LIST,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────
PREFIX = "/api/v1"
app.include_router(auth.router,        prefix=f"{PREFIX}/auth",        tags=["Auth"])
app.include_router(users.router,       prefix=f"{PREFIX}/users",       tags=["Users"])
app.include_router(market.router,      prefix=f"{PREFIX}/market",      tags=["Market Data"])
app.include_router(portfolios.router,  prefix=f"{PREFIX}/portfolios",  tags=["Portfolios"])
app.include_router(orders.router,      prefix=f"{PREFIX}/orders",      tags=["Orders"])
app.include_router(watchlists.router,  prefix=f"{PREFIX}/watchlists",  tags=["Watchlists"])
app.include_router(alerts.router,      prefix=f"{PREFIX}/alerts",      tags=["Alerts"])
app.include_router(journal.router,     prefix=f"{PREFIX}/journal",     tags=["Journal"])
app.include_router(backtesting.router, prefix=f"{PREFIX}/backtest",    tags=["Backtesting"])


@app.get("/health")
async def health():
    return {"status": "ok", "mode": "demo" if settings.DEMO_MODE else "live"}
