"""
TradeFlow — Market Data Provider Layer
=======================================
Priority chain: Polygon → Twelve Data → Alpha Vantage → Yahoo Finance (fallback)

Each provider implements the MarketDataProvider ABC.
The MarketDataManager auto-selects the best available provider,
handles rate limiting, caching, and graceful fallback.
"""
from __future__ import annotations

import asyncio
import random
import time
from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from decimal import Decimal

import httpx
import structlog

from app.core.config import settings
from app.core.redis import cache_get, cache_set

log = structlog.get_logger()


# ── Schema ─────────────────────────────────────────────────────
class Quote:
    """Normalized real-time quote."""
    def __init__(self, symbol: str, price: float, change: float, change_pct: float,
                 volume: int = 0, bid: float = 0, ask: float = 0,
                 open_: float = 0, high: float = 0, low: float = 0, prev_close: float = 0,
                 market_cap: Optional[float] = None, timestamp: Optional[datetime] = None,
                 source: str = "unknown", is_delayed: bool = False):
        self.symbol = symbol
        self.price = price
        self.change = change
        self.change_pct = change_pct
        self.volume = volume
        self.bid = bid
        self.ask = ask
        self.open = open_
        self.high = high
        self.low = low
        self.prev_close = prev_close
        self.market_cap = market_cap
        self.timestamp = timestamp or datetime.now(timezone.utc)
        self.source = source
        self.is_delayed = is_delayed

    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "price": round(self.price, 4),
            "change": round(self.change, 4),
            "change_pct": round(self.change_pct, 4),
            "volume": self.volume,
            "bid": round(self.bid, 4),
            "ask": round(self.ask, 4),
            "open": round(self.open, 4),
            "high": round(self.high, 4),
            "low": round(self.low, 4),
            "prev_close": round(self.prev_close, 4),
            "market_cap": self.market_cap,
            "timestamp": self.timestamp.isoformat(),
            "source": self.source,
            "is_delayed": self.is_delayed,
            "freshness": "live" if not self.is_delayed else "delayed",
        }


class OHLCBar:
    def __init__(self, date: str, open_: float, high: float, low: float,
                 close: float, volume: int, adj_close: Optional[float] = None):
        self.date = date
        self.open = open_
        self.high = high
        self.low = low
        self.close = close
        self.volume = volume
        self.adj_close = adj_close or close

    def to_dict(self) -> Dict[str, Any]:
        return {
            "date": self.date,
            "open": round(self.open, 4),
            "high": round(self.high, 4),
            "low": round(self.low, 4),
            "close": round(self.close, 4),
            "volume": self.volume,
            "adj_close": round(self.adj_close, 4),
        }


# ── Abstract Provider ──────────────────────────────────────────
class MarketDataProvider(ABC):
    name: str = "base"
    is_live: bool = False
    supports_websocket: bool = False

    @abstractmethod
    async def get_quote(self, symbol: str) -> Optional[Quote]:
        ...

    @abstractmethod
    async def get_quotes(self, symbols: List[str]) -> List[Quote]:
        ...

    @abstractmethod
    async def get_history(self, symbol: str, period: str = "1y", interval: str = "1d") -> List[OHLCBar]:
        ...

    async def search(self, query: str) -> List[Dict[str, Any]]:
        return []

    async def health_check(self) -> bool:
        try:
            q = await self.get_quote("AAPL")
            return q is not None
        except Exception:
            return False


# ── Yahoo Finance Provider (free fallback) ─────────────────────
class YahooFinanceProvider(MarketDataProvider):
    name = "yahoo"
    is_live = False       # 15-min delay for most markets
    supports_websocket = False

    PERIOD_MAP = {
        "1d": ("1d", "5m"), "5d": ("5d", "15m"), "1mo": ("1mo", "1d"),
        "3mo": ("3mo", "1d"), "6mo": ("6mo", "1d"), "1y": ("1y", "1d"),
        "2y": ("2y", "1wk"), "5y": ("5y", "1wk"), "max": ("max", "1mo"),
    }

    def __init__(self):
        self._client = httpx.AsyncClient(timeout=15.0, headers={
            "User-Agent": "Mozilla/5.0 (compatible; TradeFlow/1.0)"
        })

    async def _yf_quote(self, symbol: str) -> Optional[Dict]:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
        try:
            r = await self._client.get(url, params={"range": "1d", "interval": "1m"})
            r.raise_for_status()
            data = r.json()
            meta = data["chart"]["result"][0]["meta"]
            return meta
        except Exception as e:
            log.warning("yahoo.quote_failed", symbol=symbol, error=str(e))
            return None

    async def get_quote(self, symbol: str) -> Optional[Quote]:
        meta = await self._yf_quote(symbol)
        if not meta:
            return None
        price = meta.get("regularMarketPrice", 0)
        prev = meta.get("previousClose", price)
        chg = price - prev
        chg_pct = (chg / prev * 100) if prev else 0
        return Quote(
            symbol=symbol, price=price, change=chg, change_pct=chg_pct,
            volume=meta.get("regularMarketVolume", 0),
            open_=meta.get("regularMarketOpen", 0),
            high=meta.get("regularMarketDayHigh", 0),
            low=meta.get("regularMarketDayLow", 0),
            prev_close=prev,
            source="yahoo", is_delayed=True,
        )

    async def get_quotes(self, symbols: List[str]) -> List[Quote]:
        tasks = [self.get_quote(s) for s in symbols]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return [r for r in results if isinstance(r, Quote)]

    async def get_history(self, symbol: str, period: str = "1y", interval: str = "1d") -> List[OHLCBar]:
        yf_period, yf_interval = self.PERIOD_MAP.get(period, ("1y", "1d"))
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
        try:
            r = await self._client.get(url, params={"range": yf_period, "interval": yf_interval})
            r.raise_for_status()
            data = r.json()
            result = data["chart"]["result"][0]
            timestamps = result["timestamp"]
            ohlcv = result["indicators"]["quote"][0]
            adjclose = result["indicators"].get("adjclose", [{}])[0].get("adjclose", [])
            bars = []
            for i, ts in enumerate(timestamps):
                o = ohlcv["open"][i]
                h = ohlcv["high"][i]
                l = ohlcv["low"][i]
                c = ohlcv["close"][i]
                v = ohlcv["volume"][i]
                adj = adjclose[i] if adjclose and i < len(adjclose) else c
                if all(x is not None for x in [o, h, l, c]):
                    dt = datetime.fromtimestamp(ts, tz=timezone.utc)
                    bars.append(OHLCBar(dt.strftime("%Y-%m-%d"), o, h, l, c, v or 0, adj))
            return bars
        except Exception as e:
            log.warning("yahoo.history_failed", symbol=symbol, error=str(e))
            return []

    async def search(self, query: str) -> List[Dict[str, Any]]:
        url = "https://query1.finance.yahoo.com/v1/finance/search"
        try:
            r = await self._client.get(url, params={"q": query, "quotesCount": 10, "newsCount": 0})
            r.raise_for_status()
            data = r.json()
            return [
                {"symbol": q.get("symbol", ""), "name": q.get("shortname", q.get("longname", "")),
                 "exchange": q.get("exchange", ""), "type": q.get("quoteType", "").lower()}
                for q in data.get("quotes", [])
                if q.get("symbol")
            ]
        except Exception:
            return []


# ── Twelve Data Provider ───────────────────────────────────────
class TwelveDataProvider(MarketDataProvider):
    name = "twelve_data"
    is_live = True      # Real-time with paid plan, quasi-real-time free
    supports_websocket = True
    BASE = "https://api.twelvedata.com"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self._client = httpx.AsyncClient(timeout=15.0)

    async def get_quote(self, symbol: str) -> Optional[Quote]:
        try:
            r = await self._client.get(f"{self.BASE}/quote", params={
                "symbol": symbol, "apikey": self.api_key
            })
            r.raise_for_status()
            d = r.json()
            if d.get("status") == "error":
                return None
            price = float(d.get("close", 0))
            prev = float(d.get("previous_close", price))
            chg = price - prev
            chg_pct = float(d.get("percent_change", 0))
            return Quote(
                symbol=symbol, price=price, change=chg, change_pct=chg_pct,
                volume=int(d.get("volume", 0) or 0),
                open_=float(d.get("open", 0) or 0),
                high=float(d.get("high", 0) or 0),
                low=float(d.get("low", 0) or 0),
                prev_close=prev,
                source="twelve_data", is_delayed=False,
            )
        except Exception as e:
            log.warning("twelve_data.quote_failed", symbol=symbol, error=str(e))
            return None

    async def get_quotes(self, symbols: List[str]) -> List[Quote]:
        # Twelve Data supports batch requests
        try:
            r = await self._client.get(f"{self.BASE}/quote", params={
                "symbol": ",".join(symbols), "apikey": self.api_key
            })
            r.raise_for_status()
            data = r.json()
            quotes = []
            if isinstance(data, dict) and "symbol" in data:
                data = {symbols[0]: data}
            for sym, d in data.items():
                if d.get("status") == "error":
                    continue
                price = float(d.get("close", 0))
                prev = float(d.get("previous_close", price))
                quotes.append(Quote(
                    symbol=sym, price=price,
                    change=price - prev,
                    change_pct=float(d.get("percent_change", 0)),
                    volume=int(d.get("volume", 0) or 0),
                    source="twelve_data", is_delayed=False,
                ))
            return quotes
        except Exception:
            return await asyncio.gather(*[self.get_quote(s) for s in symbols])

    async def get_history(self, symbol: str, period: str = "1y", interval: str = "1d") -> List[OHLCBar]:
        OUTPUTSIZE = {"1d": 390, "1w": 2000, "1mo": 500, "3mo": 500, "6mo": 365, "1y": 365, "2y": 730, "5y": 1825}
        outputsize = OUTPUTSIZE.get(period, 365)
        try:
            r = await self._client.get(f"{self.BASE}/time_series", params={
                "symbol": symbol, "interval": "1day", "outputsize": outputsize,
                "apikey": self.api_key, "order": "ASC"
            })
            r.raise_for_status()
            data = r.json()
            if data.get("status") == "error":
                return []
            bars = []
            for bar in data.get("values", []):
                bars.append(OHLCBar(
                    bar["datetime"], float(bar["open"]), float(bar["high"]),
                    float(bar["low"]), float(bar["close"]), int(bar.get("volume", 0) or 0)
                ))
            return bars
        except Exception as e:
            log.warning("twelve_data.history_failed", symbol=symbol, error=str(e))
            return []


# ── Polygon Provider ───────────────────────────────────────────
class PolygonProvider(MarketDataProvider):
    name = "polygon"
    is_live = True
    supports_websocket = True
    BASE = "https://api.polygon.io"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self._client = httpx.AsyncClient(timeout=15.0)

    def _headers(self):
        return {"Authorization": f"Bearer {self.api_key}"}

    async def get_quote(self, symbol: str) -> Optional[Quote]:
        try:
            r = await self._client.get(
                f"{self.BASE}/v2/last/nbbo/{symbol}", headers=self._headers()
            )
            # Also get snapshot for more data
            snap = await self._client.get(
                f"{self.BASE}/v2/snapshot/locale/us/markets/stocks/tickers/{symbol}",
                headers=self._headers()
            )
            snap.raise_for_status()
            d = snap.json().get("ticker", {})
            day = d.get("day", {})
            prev_day = d.get("prevDay", {})
            price = float(d.get("lastTrade", {}).get("p", day.get("c", 0)))
            prev = float(prev_day.get("c", price))
            chg = price - prev
            chg_pct = (chg / prev * 100) if prev else 0
            return Quote(
                symbol=symbol, price=price, change=chg, change_pct=chg_pct,
                volume=int(day.get("v", 0)),
                bid=float(d.get("lastQuote", {}).get("P", 0)),
                ask=float(d.get("lastQuote", {}).get("p", 0)),
                open_=float(day.get("o", 0)),
                high=float(day.get("h", 0)),
                low=float(day.get("l", 0)),
                prev_close=prev,
                source="polygon", is_delayed=False,
            )
        except Exception as e:
            log.warning("polygon.quote_failed", symbol=symbol, error=str(e))
            return None

    async def get_quotes(self, symbols: List[str]) -> List[Quote]:
        tasks = [self.get_quote(s) for s in symbols]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return [r for r in results if isinstance(r, Quote)]

    async def get_history(self, symbol: str, period: str = "1y", interval: str = "1d") -> List[OHLCBar]:
        from_date = (datetime.now(timezone.utc) - timedelta(days=365)).strftime("%Y-%m-%d")
        to_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        try:
            r = await self._client.get(
                f"{self.BASE}/v2/aggs/ticker/{symbol}/range/1/day/{from_date}/{to_date}",
                params={"adjusted": "true", "sort": "asc", "limit": 50000},
                headers=self._headers()
            )
            r.raise_for_status()
            data = r.json()
            bars = []
            for bar in data.get("results", []):
                dt = datetime.fromtimestamp(bar["t"] / 1000, tz=timezone.utc)
                bars.append(OHLCBar(
                    dt.strftime("%Y-%m-%d"),
                    float(bar["o"]), float(bar["h"]), float(bar["l"]),
                    float(bar["c"]), int(bar.get("v", 0)), float(bar.get("vw", bar["c"]))
                ))
            return bars
        except Exception as e:
            log.warning("polygon.history_failed", symbol=symbol, error=str(e))
            return []


# ── Demo / Mock Provider ───────────────────────────────────────
class DemoProvider(MarketDataProvider):
    """Realistic mock data for demo mode. Generates coherent prices with volatility."""
    name = "demo"
    is_live = False
    supports_websocket = False

    MOCK_ASSETS = {
        "AAPL": {"base": 189.84, "name": "Apple Inc.", "sector": "Technology", "vol": 0.014},
        "MSFT": {"base": 415.26, "name": "Microsoft Corp.", "sector": "Technology", "vol": 0.012},
        "NVDA": {"base": 875.40, "name": "NVIDIA Corp.", "sector": "Technology", "vol": 0.025},
        "TSLA": {"base": 248.50, "name": "Tesla Inc.", "sector": "Consumer Cyclical", "vol": 0.03},
        "GOOGL": {"base": 175.98, "name": "Alphabet Inc.", "sector": "Communication Services", "vol": 0.013},
        "AMZN": {"base": 192.45, "name": "Amazon.com", "sector": "Consumer Cyclical", "vol": 0.016},
        "META": {"base": 507.80, "name": "Meta Platforms", "sector": "Communication Services", "vol": 0.018},
        "MC.PA": {"base": 720.40, "name": "LVMH", "sector": "Consumer Defensive", "vol": 0.011},
        "TTE.PA": {"base": 62.85, "name": "TotalEnergies", "sector": "Energy", "vol": 0.013},
        "AIR.PA": {"base": 165.72, "name": "Airbus SE", "sector": "Industrials", "vol": 0.014},
        "SPY": {"base": 521.78, "name": "SPDR S&P 500 ETF", "sector": "ETF", "vol": 0.009},
        "QQQ": {"base": 440.50, "name": "Invesco QQQ Trust", "sector": "ETF", "vol": 0.011},
        "BTC-USD": {"base": 67850.00, "name": "Bitcoin USD", "sector": "Cryptocurrency", "vol": 0.035},
        "ETH-USD": {"base": 3420.00, "name": "Ethereum USD", "sector": "Cryptocurrency", "vol": 0.04},
    }

    def __init__(self, seed: int = 42):
        self._seed = seed
        self._prices: Dict[str, float] = {}
        self._last_update: Dict[str, datetime] = {}
        # Initialize with base prices + small noise
        rng = random.Random(seed)
        for sym, info in self.MOCK_ASSETS.items():
            self._prices[sym] = info["base"] * (1 + rng.uniform(-0.02, 0.02))

    def _tick_price(self, symbol: str) -> float:
        """Apply small random walk to simulate live ticking."""
        info = self.MOCK_ASSETS.get(symbol, {"base": 100, "vol": 0.015})
        vol = info["vol"]
        current = self._prices.get(symbol, info["base"])
        # Small drift toward base to prevent runaway prices
        base = info["base"]
        drift = (base - current) / base * 0.001
        change_pct = random.gauss(drift, vol / 10)
        new_price = current * (1 + change_pct)
        new_price = max(new_price, base * 0.3)  # floor at 30% of base
        self._prices[symbol] = new_price
        return new_price

    async def get_quote(self, symbol: str) -> Optional[Quote]:
        if symbol not in self.MOCK_ASSETS:
            return None
        info = self.MOCK_ASSETS[symbol]
        price = self._tick_price(symbol)
        base = info["base"]
        prev = base * (1 + random.gauss(0, info["vol"] * 2))
        chg = price - prev
        chg_pct = chg / prev * 100
        spread = price * 0.0001
        return Quote(
            symbol=symbol, price=round(price, 4), change=round(chg, 4),
            change_pct=round(chg_pct, 4),
            volume=int(random.randint(1_000_000, 80_000_000)),
            bid=round(price - spread, 4), ask=round(price + spread, 4),
            open_=round(base * (1 + random.gauss(0, 0.005)), 4),
            high=round(price * 1.01, 4), low=round(price * 0.99, 4),
            prev_close=round(prev, 4),
            source="demo", is_delayed=False,
        )

    async def get_quotes(self, symbols: List[str]) -> List[Quote]:
        quotes = []
        for sym in symbols:
            q = await self.get_quote(sym)
            if q:
                quotes.append(q)
        return quotes

    async def get_history(self, symbol: str, period: str = "1y", interval: str = "1d") -> List[OHLCBar]:
        days_map = {"1d": 1, "5d": 5, "1mo": 30, "3mo": 90, "6mo": 180, "1y": 365, "2y": 730, "5y": 1825, "max": 2000}
        n_days = days_map.get(period, 365)
        info = self.MOCK_ASSETS.get(symbol, {"base": 100, "vol": 0.015})
        base = info["base"]
        vol = info["vol"]
        bars = []
        rng = random.Random(hash(symbol) % 1000)
        price = base * (1 - vol * rng.uniform(5, 15))
        for i in range(n_days, -1, -1):
            dt = datetime.now(timezone.utc) - timedelta(days=i)
            if dt.weekday() >= 5:  # skip weekends
                continue
            daily_ret = rng.gauss(0.0003, vol)
            price *= (1 + daily_ret)
            o = price * (1 + rng.gauss(0, 0.003))
            h = max(price, o) * (1 + abs(rng.gauss(0, 0.005)))
            l = min(price, o) * (1 - abs(rng.gauss(0, 0.005)))
            v = int(rng.randint(2_000_000, 60_000_000))
            bars.append(OHLCBar(dt.strftime("%Y-%m-%d"), round(o, 4), round(h, 4), round(l, 4), round(price, 4), v))
        return bars

    async def search(self, query: str) -> List[Dict[str, Any]]:
        q = query.upper()
        results = []
        for sym, info in self.MOCK_ASSETS.items():
            if q in sym or q.lower() in info["name"].lower():
                results.append({"symbol": sym, "name": info["name"], "exchange": "DEMO", "type": "stock"})
        return results[:10]


# ── Manager — auto-selects and falls back ──────────────────────
class MarketDataManager:
    """
    Singleton that selects the best provider and falls back automatically.
    Wraps all calls with Redis caching.
    """

    def __init__(self):
        self._providers: List[MarketDataProvider] = []
        self._active: Optional[MarketDataProvider] = None
        self._build_chain()

    def _build_chain(self):
        if settings.DEMO_MODE:
            self._providers = [DemoProvider(settings.DEMO_SEED)]
        else:
            chain = []
            if settings.POLYGON_API_KEY:
                chain.append(PolygonProvider(settings.POLYGON_API_KEY))
            if settings.TWELVE_DATA_API_KEY:
                chain.append(TwelveDataProvider(settings.TWELVE_DATA_API_KEY))
            if settings.YAHOO_FALLBACK:
                chain.append(YahooFinanceProvider())
            if not chain:
                log.warning("market_data.no_provider_configured, falling back to demo")
                chain.append(DemoProvider(settings.DEMO_SEED))
            self._providers = chain
        self._active = self._providers[0]
        log.info("market_data.provider_selected", provider=self._active.name)

    async def _with_fallback(self, method: str, *args, **kwargs) -> Any:
        for provider in self._providers:
            try:
                result = await getattr(provider, method)(*args, **kwargs)
                if result:
                    self._active = provider
                    return result
            except Exception as e:
                log.warning("provider.failed", provider=provider.name, method=method, error=str(e))
                continue
        return None

    async def get_quote(self, symbol: str) -> Optional[Dict[str, Any]]:
        cache_key = f"quote:{symbol}"
        cached = await cache_get(cache_key)
        if cached:
            return cached
        quote = await self._with_fallback("get_quote", symbol)
        if quote:
            d = quote.to_dict()
            await cache_set(cache_key, d, ttl=settings.PRICE_CACHE_TTL)
            return d
        return None

    async def get_quotes(self, symbols: List[str]) -> List[Dict[str, Any]]:
        result = []
        missing = []
        for sym in symbols:
            cached = await cache_get(f"quote:{sym}")
            if cached:
                result.append(cached)
            else:
                missing.append(sym)
        if missing:
            quotes = await self._with_fallback("get_quotes", missing) or []
            for q in quotes:
                d = q.to_dict()
                await cache_set(f"quote:{q.symbol}", d, ttl=settings.PRICE_CACHE_TTL)
                result.append(d)
        return result

    async def get_history(self, symbol: str, period: str = "1y") -> List[Dict[str, Any]]:
        cache_key = f"history:{symbol}:{period}"
        cached = await cache_get(cache_key)
        if cached:
            return cached
        bars = await self._with_fallback("get_history", symbol, period) or []
        data = [b.to_dict() for b in bars]
        if data:
            await cache_set(cache_key, data, ttl=settings.HISTORY_CACHE_TTL)
        return data

    async def search(self, query: str) -> List[Dict[str, Any]]:
        return await self._with_fallback("search", query) or []

    @property
    def active_provider_name(self) -> str:
        return self._active.name if self._active else "none"

    @property
    def is_live(self) -> bool:
        return self._active.is_live if self._active else False


# Singleton
market_data_manager = MarketDataManager()
