"""
TradeFlow — All API v1 Routers
Organized by domain. Each router is imported in main.py.
"""
from __future__ import annotations
import asyncio
import json
from datetime import timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import (create_access_token, get_current_user,
                                hash_password, verify_password)
from app.models import (Alert, AlertType, JournalEntry, Order, OrderSide,
                         OrderStatus, OrderType, Portfolio, Position,
                         User, Watchlist, WatchlistItem)
from app.services.market_data.provider import market_data_manager
from app.services.backtesting.engine import Bar, run_backtest, STRATEGIES
from app.core.redis import redis_client

log = structlog.get_logger()

# ═══════════════════════════════════════════════════════════════
# AUTH
# ═══════════════════════════════════════════════════════════════
router_auth = APIRouter()


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=8)
    full_name: Optional[str] = None


class UserOut(BaseModel):
    id: int
    email: str
    username: str
    full_name: Optional[str]
    currency: str
    theme: str
    is_demo: bool

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


@router_auth.post("/register", response_model=Token, status_code=201)
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
    # Check uniqueness
    existing = await db.execute(
        select(User).where((User.email == data.email) | (User.username == data.username))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Email or username already registered")

    user = User(
        email=data.email,
        username=data.username,
        full_name=data.full_name,
        hashed_password=hash_password(data.password),
    )
    db.add(user)
    await db.flush()

    # Create default portfolio
    portfolio = Portfolio(
        user_id=user.id,
        name="Mon Portefeuille",
        initial_cash=Decimal("100000"),
        cash=Decimal("100000"),
        is_default=True,
    )
    db.add(portfolio)

    # Create default watchlist
    wl = Watchlist(user_id=user.id, name="Ma Watchlist")
    db.add(wl)
    await db.flush()

    # Add default symbols to watchlist
    for sym in ["AAPL", "MSFT", "NVDA", "SPY", "BTC-USD"]:
        db.add(WatchlistItem(watchlist_id=wl.id, symbol=sym))

    token = create_access_token({"sub": str(user.id)})
    return Token(access_token=token, token_type="bearer", user=UserOut.model_validate(user))


@router_auth.post("/token", response_model=Token)
async def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where((User.email == form.username) | (User.username == form.username))
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": str(user.id)})
    return Token(access_token=token, token_type="bearer", user=UserOut.model_validate(user))


# ═══════════════════════════════════════════════════════════════
# USERS
# ═══════════════════════════════════════════════════════════════
router_users = APIRouter()


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    currency: Optional[str] = None
    theme: Optional[str] = None
    timezone: Optional[str] = None


@router_users.get("/me", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user)):
    return user


@router_users.patch("/me", response_model=UserOut)
async def update_me(
    data: UserUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(user, k, v)
    db.add(user)
    return user


# ═══════════════════════════════════════════════════════════════
# MARKET DATA
# ═══════════════════════════════════════════════════════════════
router_market = APIRouter()


@router_market.get("/quote/{symbol}")
async def get_quote(symbol: str):
    quote = await market_data_manager.get_quote(symbol.upper())
    if not quote:
        raise HTTPException(404, f"Quote not found for {symbol}")
    return quote


@router_market.get("/quotes")
async def get_quotes(symbols: str = Query(..., description="Comma-separated symbols")):
    syms = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if not syms:
        raise HTTPException(400, "No symbols provided")
    return await market_data_manager.get_quotes(syms)


@router_market.get("/history/{symbol}")
async def get_history(
    symbol: str,
    period: str = Query("1y", pattern="^(1d|5d|1mo|3mo|6mo|1y|2y|5y|max)$"),
):
    data = await market_data_manager.get_history(symbol.upper(), period)
    if not data:
        raise HTTPException(404, f"History not found for {symbol}")
    return {"symbol": symbol.upper(), "period": period, "bars": data}


@router_market.get("/search")
async def search_assets(q: str = Query(..., min_length=1)):
    return await market_data_manager.search(q)


@router_market.get("/provider")
async def get_provider_info():
    return {
        "active_provider": market_data_manager.active_provider_name,
        "is_live": market_data_manager.is_live,
        "demo_mode": True,
    }


# WebSocket for real-time price streaming
@router_market.websocket("/ws/prices")
async def ws_prices(websocket: WebSocket):
    await websocket.accept()
    symbols = set()
    pubsub = redis_client.pubsub()
    try:
        # Subscribe to batch updates by default
        await pubsub.subscribe("prices:batch")

        async def recv_client():
            """Receive subscription requests from client."""
            try:
                while True:
                    msg = await websocket.receive_json()
                    action = msg.get("action", "")
                    syms = [s.upper() for s in msg.get("symbols", [])]
                    if action == "subscribe":
                        for s in syms:
                            symbols.add(s)
                            await pubsub.subscribe(f"prices:{s}")
                    elif action == "unsubscribe":
                        for s in syms:
                            symbols.discard(s)
                            await pubsub.unsubscribe(f"prices:{s}")
            except Exception:
                pass

        async def send_prices():
            """Forward Redis pub/sub messages to client."""
            async for message in pubsub.listen():
                if message["type"] == "message":
                    try:
                        data = json.loads(message["data"])
                        await websocket.send_json({"type": "price_update", "data": data})
                    except Exception:
                        pass

        await asyncio.gather(recv_client(), send_prices())

    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe()
        await pubsub.aclose()


# ═══════════════════════════════════════════════════════════════
# PORTFOLIOS
# ═══════════════════════════════════════════════════════════════
router_portfolios = APIRouter()

FEE_RATE = Decimal("0.001")
FIXED_FEE = Decimal("1.0")


class PortfolioCreate(BaseModel):
    name: str
    description: Optional[str] = None
    initial_cash: float = 100_000.0
    currency: str = "EUR"


class PortfolioOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    cash: float
    initial_cash: float
    currency: str
    is_default: bool

    class Config:
        from_attributes = True


async def _enrich_portfolio(portfolio: Portfolio) -> Dict[str, Any]:
    """Add live prices to portfolio positions."""
    pos_data = []
    total_value = float(portfolio.cash)
    total_cost = 0.0

    for pos in portfolio.positions:
        if pos.quantity <= 0:
            continue
        quote = await market_data_manager.get_quote(pos.symbol)
        price = float(quote["price"]) if quote else float(pos.avg_cost)
        mv = float(pos.quantity) * price
        cost = float(pos.quantity) * float(pos.avg_cost)
        pnl = mv - cost
        pnl_pct = (pnl / cost * 100) if cost > 0 else 0
        total_value += mv
        total_cost += cost
        pos_data.append({
            "id": pos.id,
            "symbol": pos.symbol,
            "quantity": float(pos.quantity),
            "avg_cost": float(pos.avg_cost),
            "current_price": price,
            "market_value": round(mv, 2),
            "cost_basis": round(cost, 2),
            "unrealized_pnl": round(pnl, 2),
            "unrealized_pnl_pct": round(pnl_pct, 2),
            "weight_pct": 0,  # filled below
            "realized_pnl": float(pos.realized_pnl),
            "source": quote.get("source", "cache") if quote else "cache",
        })

    for p in pos_data:
        p["weight_pct"] = round(p["market_value"] / total_value * 100, 2) if total_value > 0 else 0

    total_pnl = total_value - float(portfolio.initial_cash)
    total_pnl_pct = (total_pnl / float(portfolio.initial_cash) * 100) if portfolio.initial_cash > 0 else 0

    return {
        "id": portfolio.id,
        "name": portfolio.name,
        "description": portfolio.description,
        "currency": portfolio.currency,
        "cash": round(float(portfolio.cash), 2),
        "initial_cash": float(portfolio.initial_cash),
        "is_default": portfolio.is_default,
        "total_value": round(total_value, 2),
        "total_cost": round(total_cost, 2),
        "total_pnl": round(total_pnl, 2),
        "total_pnl_pct": round(total_pnl_pct, 2),
        "positions": pos_data,
    }


@router_portfolios.get("/")
async def list_portfolios(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Portfolio)
        .options(selectinload(Portfolio.positions))
        .where(Portfolio.user_id == user.id, Portfolio.is_archived == False)
    )
    portfolios = result.scalars().all()
    return [await _enrich_portfolio(p) for p in portfolios]


@router_portfolios.post("/", status_code=201)
async def create_portfolio(
    data: PortfolioCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    portfolio = Portfolio(
        user_id=user.id,
        name=data.name,
        description=data.description,
        initial_cash=Decimal(str(data.initial_cash)),
        cash=Decimal(str(data.initial_cash)),
        currency=data.currency,
    )
    db.add(portfolio)
    await db.flush()
    return {"id": portfolio.id, "name": portfolio.name, "cash": float(portfolio.cash)}


@router_portfolios.get("/{portfolio_id}")
async def get_portfolio(
    portfolio_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Portfolio)
        .options(selectinload(Portfolio.positions))
        .where(Portfolio.id == portfolio_id, Portfolio.user_id == user.id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Portfolio not found")
    return await _enrich_portfolio(p)


# ═══════════════════════════════════════════════════════════════
# ORDERS
# ═══════════════════════════════════════════════════════════════
router_orders = APIRouter()


class OrderCreate(BaseModel):
    portfolio_id: int
    symbol: str
    side: OrderSide
    order_type: OrderType = OrderType.MARKET
    quantity: float = Field(gt=0)
    limit_price: Optional[float] = None
    stop_price: Optional[float] = None
    note: Optional[str] = None


@router_orders.post("/", status_code=201)
async def place_order(
    data: OrderCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify portfolio ownership
    result = await db.execute(
        select(Portfolio)
        .options(selectinload(Portfolio.positions))
        .where(Portfolio.id == data.portfolio_id, Portfolio.user_id == user.id)
    )
    portfolio = result.scalar_one_or_none()
    if not portfolio:
        raise HTTPException(404, "Portfolio not found")

    # Get live price
    quote = await market_data_manager.get_quote(data.symbol.upper())
    if not quote:
        raise HTTPException(400, f"Cannot get price for {data.symbol}")

    market_price = Decimal(str(quote["price"]))
    fill_price = market_price

    if data.order_type == OrderType.LIMIT and data.limit_price:
        fill_price = Decimal(str(data.limit_price))
    elif data.order_type == OrderType.STOP and data.stop_price:
        fill_price = Decimal(str(data.stop_price))

    qty = Decimal(str(data.quantity))
    gross = qty * fill_price
    fees = gross * FEE_RATE + FIXED_FEE
    slippage = gross * Decimal("0.0005")

    if data.side == OrderSide.BUY:
        total_cost = gross + fees + slippage
        if portfolio.cash < total_cost:
            raise HTTPException(400, f"Insufficient cash. Need {total_cost:.2f}, have {portfolio.cash:.2f}")

        # Deduct cash
        portfolio.cash -= total_cost

        # Update or create position
        pos_result = await db.execute(
            select(Position).where(
                Position.portfolio_id == portfolio.id,
                Position.symbol == data.symbol.upper(),
            )
        )
        position = pos_result.scalar_one_or_none()
        if position:
            # Weighted average cost
            total_qty = position.quantity + qty
            total_basis = position.quantity * position.avg_cost + qty * fill_price
            position.avg_cost = total_basis / total_qty
            position.quantity = total_qty
        else:
            position = Position(
                portfolio_id=portfolio.id,
                symbol=data.symbol.upper(),
                quantity=qty,
                avg_cost=fill_price,
            )
            db.add(position)
        position.total_fees_paid += fees

    else:  # SELL
        pos_result = await db.execute(
            select(Position).where(
                Position.portfolio_id == portfolio.id,
                Position.symbol == data.symbol.upper(),
            )
        )
        position = pos_result.scalar_one_or_none()
        if not position or position.quantity < qty:
            raise HTTPException(400, f"Insufficient shares. Have {position.quantity if position else 0}")

        proceeds = gross - fees - slippage
        realized_pnl = (fill_price - position.avg_cost) * qty - fees - slippage

        position.quantity -= qty
        position.realized_pnl += realized_pnl
        portfolio.cash += proceeds

        if position.quantity == 0:
            await db.delete(position)

    # Create order record
    order = Order(
        portfolio_id=portfolio.id,
        symbol=data.symbol.upper(),
        side=data.side,
        order_type=data.order_type,
        status=OrderStatus.FILLED,
        quantity=qty,
        filled_quantity=qty,
        limit_price=Decimal(str(data.limit_price)) if data.limit_price else None,
        stop_price=Decimal(str(data.stop_price)) if data.stop_price else None,
        filled_price=fill_price,
        fees=fees,
        slippage=slippage,
        total_cost=gross + fees + slippage if data.side == OrderSide.BUY else gross - fees - slippage,
        note=data.note,
    )
    db.add(order)
    await db.flush()

    return {
        "order_id": order.id,
        "status": "FILLED",
        "symbol": data.symbol.upper(),
        "side": data.side,
        "quantity": float(qty),
        "filled_price": float(fill_price),
        "fees": float(fees),
        "slippage": float(slippage),
        "total": float(order.total_cost),
        "cash_remaining": float(portfolio.cash),
    }


@router_orders.get("/{portfolio_id}/history")
async def order_history(
    portfolio_id: int,
    limit: int = Query(50, le=200),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Portfolio).where(Portfolio.id == portfolio_id, Portfolio.user_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Portfolio not found")

    orders_result = await db.execute(
        select(Order)
        .where(Order.portfolio_id == portfolio_id)
        .order_by(Order.created_at.desc())
        .limit(limit)
    )
    orders = orders_result.scalars().all()
    return [
        {
            "id": o.id,
            "symbol": o.symbol,
            "side": o.side,
            "type": o.order_type,
            "status": o.status,
            "quantity": float(o.quantity),
            "filled_price": float(o.filled_price) if o.filled_price else None,
            "fees": float(o.fees),
            "total": float(o.total_cost) if o.total_cost else None,
            "note": o.note,
            "date": o.created_at.isoformat(),
        }
        for o in orders
    ]


# ═══════════════════════════════════════════════════════════════
# WATCHLISTS
# ═══════════════════════════════════════════════════════════════
router_watchlists = APIRouter()


@router_watchlists.get("/")
async def list_watchlists(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Watchlist)
        .options(selectinload(Watchlist.items))
        .where(Watchlist.user_id == user.id)
    )
    watchlists = result.scalars().all()
    out = []
    for wl in watchlists:
        symbols = [item.symbol for item in wl.items]
        quotes = await market_data_manager.get_quotes(symbols) if symbols else []
        quote_map = {q["symbol"]: q for q in quotes}
        out.append({
            "id": wl.id,
            "name": wl.name,
            "items": [
                {"symbol": item.symbol, **quote_map.get(item.symbol, {})}
                for item in wl.items
            ],
        })
    return out


@router_watchlists.post("/{watchlist_id}/symbols")
async def add_symbol(
    watchlist_id: int,
    symbol: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Watchlist).where(Watchlist.id == watchlist_id, Watchlist.user_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Watchlist not found")
    item = WatchlistItem(watchlist_id=watchlist_id, symbol=symbol.upper())
    db.add(item)
    return {"added": symbol.upper()}


@router_watchlists.delete("/{watchlist_id}/symbols/{symbol}")
async def remove_symbol(
    watchlist_id: int,
    symbol: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        delete(WatchlistItem).where(
            WatchlistItem.watchlist_id == watchlist_id,
            WatchlistItem.symbol == symbol.upper(),
        )
    )
    return {"removed": symbol.upper()}


# ═══════════════════════════════════════════════════════════════
# ALERTS
# ═══════════════════════════════════════════════════════════════
router_alerts = APIRouter()


class AlertCreate(BaseModel):
    symbol: str
    alert_type: AlertType
    threshold: float


@router_alerts.get("/")
async def list_alerts(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Alert).where(Alert.user_id == user.id).order_by(Alert.created_at.desc()))
    return [
        {"id": a.id, "symbol": a.symbol, "type": a.alert_type, "threshold": float(a.threshold),
         "is_active": a.is_active, "triggered_at": a.triggered_at.isoformat() if a.triggered_at else None,
         "created_at": a.created_at.isoformat()}
        for a in result.scalars().all()
    ]


@router_alerts.post("/", status_code=201)
async def create_alert(data: AlertCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    alert = Alert(user_id=user.id, symbol=data.symbol.upper(), alert_type=data.alert_type,
                  threshold=Decimal(str(data.threshold)))
    db.add(alert)
    await db.flush()
    return {"id": alert.id, "created": True}


@router_alerts.delete("/{alert_id}")
async def delete_alert(alert_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Alert).where(Alert.id == alert_id, Alert.user_id == user.id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(404)
    await db.delete(alert)
    return {"deleted": True}


# ═══════════════════════════════════════════════════════════════
# JOURNAL
# ═══════════════════════════════════════════════════════════════
router_journal = APIRouter()


class JournalCreate(BaseModel):
    symbol: Optional[str] = None
    order_id: Optional[int] = None
    title: Optional[str] = None
    thesis: Optional[str] = None
    emotion: Optional[str] = None
    confidence: Optional[int] = Field(None, ge=1, le=5)
    outcome: Optional[str] = None
    tags: Optional[List[str]] = None


@router_journal.get("/")
async def list_journal(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(JournalEntry).where(JournalEntry.user_id == user.id).order_by(JournalEntry.created_at.desc())
    )
    return [
        {"id": e.id, "symbol": e.symbol, "order_id": e.order_id, "title": e.title,
         "thesis": e.thesis, "emotion": e.emotion, "confidence": e.confidence,
         "outcome": e.outcome, "tags": e.tags.split(",") if e.tags else [],
         "created_at": e.created_at.isoformat()}
        for e in result.scalars().all()
    ]


@router_journal.post("/", status_code=201)
async def create_entry(data: JournalCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    entry = JournalEntry(
        user_id=user.id, symbol=data.symbol, order_id=data.order_id,
        title=data.title, thesis=data.thesis, emotion=data.emotion,
        confidence=data.confidence, outcome=data.outcome,
        tags=",".join(data.tags) if data.tags else None,
    )
    db.add(entry)
    await db.flush()
    return {"id": entry.id, "created": True}


# ═══════════════════════════════════════════════════════════════
# BACKTESTING
# ═══════════════════════════════════════════════════════════════
router_backtesting = APIRouter()


class BacktestRequest(BaseModel):
    symbol: str
    strategy: str
    period: str = "1y"
    initial_capital: float = 10_000.0
    fee_rate: float = 0.001
    # Strategy params
    fast: int = 20
    slow: int = 50
    rsi_period: int = 14
    oversold: float = 30
    overbought: float = 70
    bb_period: int = 20
    bb_std: float = 2.0


@router_backtesting.get("/strategies")
async def list_strategies():
    return [
        {"id": "sma_cross", "name": "SMA Crossover", "params": ["fast", "slow"],
         "description": "Achète quand la MA rapide croise au-dessus de la MA lente."},
        {"id": "rsi", "name": "RSI Mean Reversion", "params": ["rsi_period", "oversold", "overbought"],
         "description": "Achète en zone de survente, vend en zone de surachat."},
        {"id": "bollinger_bands", "name": "Bollinger Bands", "params": ["bb_period", "bb_std"],
         "description": "Achète sous la bande inférieure, vend au-dessus de la bande supérieure."},
        {"id": "buy_and_hold", "name": "Buy & Hold", "params": [],
         "description": "Achète dès le premier jour, conserve jusqu'à la fin."},
    ]


@router_backtesting.post("/run")
async def run_backtest_endpoint(req: BacktestRequest):
    # Fetch historical data
    bars_data = await market_data_manager.get_history(req.symbol.upper(), req.period)
    if not bars_data or len(bars_data) < 10:
        raise HTTPException(400, f"Not enough data for {req.symbol} ({len(bars_data) if bars_data else 0} bars)")

    bars = [
        Bar(
            date=b["date"], open_=b["open"], high=b["high"],
            low=b["low"], close=b["close"], volume=b.get("volume", 0)
        )
        for b in bars_data
    ]

    params = {
        "fast": req.fast, "slow": req.slow,
        "period": req.rsi_period, "oversold": req.oversold, "overbought": req.overbought,
        "bb_period": req.bb_period, "std_dev": req.bb_std,
    }

    result = run_backtest(
        bars=bars, strategy_name=req.strategy, symbol=req.symbol.upper(),
        initial_capital=req.initial_capital, fee_rate=req.fee_rate,
        **params,
    )
    return vars(result)


# ── Export all routers ─────────────────────────────────────────
auth      = type("M", (), {"router": router_auth})()
users     = type("M", (), {"router": router_users})()
market    = type("M", (), {"router": router_market})()
portfolios= type("M", (), {"router": router_portfolios})()
orders    = type("M", (), {"router": router_orders})()
watchlists= type("M", (), {"router": router_watchlists})()
alerts    = type("M", (), {"router": router_alerts})()
journal   = type("M", (), {"router": router_journal})()
backtesting=type("M", (), {"router": router_backtesting})()
