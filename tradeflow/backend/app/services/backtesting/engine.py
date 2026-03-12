"""
TradeFlow Backtesting Engine
Supports: SMA crossover, RSI, MACD, Bollinger Bands, Buy & Hold, custom strategies.
Returns: equity curve, trades log, full performance metrics.
"""
from __future__ import annotations
import math
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional
from datetime import datetime


@dataclass
class Bar:
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: int


@dataclass
class Trade:
    entry_date: str
    exit_date: str
    symbol: str
    side: str  # LONG / SHORT
    qty: float
    entry_price: float
    exit_price: float
    pnl: float
    pnl_pct: float
    fees: float
    duration_days: int


@dataclass
class BacktestResult:
    strategy_name: str
    symbol: str
    period: str
    initial_capital: float
    final_capital: float
    total_return_pct: float
    annualized_return_pct: float
    max_drawdown_pct: float
    sharpe_ratio: float
    sortino_ratio: float
    calmar_ratio: float
    win_rate_pct: float
    profit_factor: float
    total_trades: int
    winning_trades: int
    losing_trades: int
    avg_trade_pct: float
    avg_win_pct: float
    avg_loss_pct: float
    best_trade_pct: float
    worst_trade_pct: float
    avg_holding_days: float
    equity_curve: List[Dict[str, Any]]   # [{date, value, drawdown_pct}]
    trades: List[Dict[str, Any]]
    benchmark_return_pct: float          # Buy & Hold comparison
    parameters: Dict[str, Any]


class Strategy:
    """Base class for all strategies."""
    name: str = "base"

    def generate_signals(self, bars: List[Bar], **params) -> List[int]:
        """Return list of signals: +1 BUY, -1 SELL, 0 HOLD. Same length as bars."""
        raise NotImplementedError


class SMACrossStrategy(Strategy):
    """Simple Moving Average crossover: fast MA crosses above slow MA → BUY."""
    name = "sma_cross"

    def generate_signals(self, bars: List[Bar], fast: int = 20, slow: int = 50, **kwargs) -> List[int]:
        closes = [b.close for b in bars]
        n = len(closes)
        signals = [0] * n

        def sma(data, period, i):
            if i < period - 1:
                return None
            return sum(data[i-period+1:i+1]) / period

        prev_fast = prev_slow = None
        for i in range(n):
            f = sma(closes, fast, i)
            s = sma(closes, slow, i)
            if f and s and prev_fast and prev_slow:
                if prev_fast <= prev_slow and f > s:
                    signals[i] = 1   # Golden cross → BUY
                elif prev_fast >= prev_slow and f < s:
                    signals[i] = -1  # Death cross → SELL
            if f and s:
                prev_fast, prev_slow = f, s
        return signals


class RSIStrategy(Strategy):
    name = "rsi"

    def generate_signals(self, bars: List[Bar], period: int = 14,
                         oversold: float = 30, overbought: float = 70, **kwargs) -> List[int]:
        closes = [b.close for b in bars]
        n = len(closes)
        signals = [0] * n

        gains, losses = [], []
        for i in range(1, n):
            diff = closes[i] - closes[i-1]
            gains.append(max(diff, 0))
            losses.append(max(-diff, 0))

        rsi_values = [None] * n
        if len(gains) >= period:
            avg_gain = sum(gains[:period]) / period
            avg_loss = sum(losses[:period]) / period
            for i in range(period, n):
                if avg_loss == 0:
                    rsi_values[i] = 100
                else:
                    rs = avg_gain / avg_loss
                    rsi_values[i] = 100 - (100 / (1 + rs))
                avg_gain = (avg_gain * (period - 1) + gains[i-1]) / period
                avg_loss = (avg_loss * (period - 1) + losses[i-1]) / period

        in_position = False
        for i in range(n):
            r = rsi_values[i]
            if r is None:
                continue
            if r < oversold and not in_position:
                signals[i] = 1
                in_position = True
            elif r > overbought and in_position:
                signals[i] = -1
                in_position = False
        return signals


class BuyAndHoldStrategy(Strategy):
    name = "buy_and_hold"

    def generate_signals(self, bars: List[Bar], **kwargs) -> List[int]:
        signals = [0] * len(bars)
        if signals:
            signals[0] = 1  # Buy on day 1, hold forever
        return signals


class BollingerBandsStrategy(Strategy):
    name = "bollinger_bands"

    def generate_signals(self, bars: List[Bar], period: int = 20, std_dev: float = 2.0, **kwargs) -> List[int]:
        closes = [b.close for b in bars]
        n = len(closes)
        signals = [0] * n
        in_position = False

        for i in range(period - 1, n):
            window = closes[i-period+1:i+1]
            mean = sum(window) / period
            std = math.sqrt(sum((x - mean) ** 2 for x in window) / period)
            upper = mean + std_dev * std
            lower = mean - std_dev * std
            price = closes[i]
            if price < lower and not in_position:
                signals[i] = 1
                in_position = True
            elif price > upper and in_position:
                signals[i] = -1
                in_position = False
        return signals


STRATEGIES: Dict[str, Strategy] = {
    "sma_cross": SMACrossStrategy(),
    "rsi": RSIStrategy(),
    "buy_and_hold": BuyAndHoldStrategy(),
    "bollinger_bands": BollingerBandsStrategy(),
}


def run_backtest(
    bars: List[Bar],
    strategy_name: str,
    symbol: str,
    initial_capital: float = 10_000.0,
    fee_rate: float = 0.001,   # 0.1%
    fixed_fee: float = 1.0,
    slippage: float = 0.0005,  # 0.05%
    **strategy_params,
) -> BacktestResult:
    strategy = STRATEGIES.get(strategy_name)
    if not strategy:
        raise ValueError(f"Unknown strategy: {strategy_name}. Available: {list(STRATEGIES)}")

    signals = strategy.generate_signals(bars, **strategy_params)

    capital = initial_capital
    position = 0.0
    entry_price = 0.0
    entry_date = ""
    equity_curve = []
    trades: List[Trade] = []

    peak_equity = capital
    max_drawdown = 0.0

    for i, (bar, signal) in enumerate(zip(bars, signals)):
        # Current portfolio value
        price = bar.close
        equity = capital + position * price
        equity_curve.append({"date": bar.date, "value": round(equity, 2)})

        # Track drawdown
        peak_equity = max(peak_equity, equity)
        drawdown = (peak_equity - equity) / peak_equity * 100
        max_drawdown = max(max_drawdown, drawdown)
        equity_curve[-1]["drawdown_pct"] = round(-drawdown, 2)

        if signal == 1 and position == 0 and capital > 0:
            # BUY
            fill_price = price * (1 + slippage)
            fees = capital * fee_rate + fixed_fee
            shares = (capital - fees) / fill_price
            if shares > 0:
                position = shares
                entry_price = fill_price
                entry_date = bar.date
                capital = 0

        elif signal == -1 and position > 0:
            # SELL
            fill_price = price * (1 - slippage)
            gross = position * fill_price
            fees = gross * fee_rate + fixed_fee
            net = gross - fees
            capital = net
            pnl = net - position * entry_price
            pnl_pct = pnl / (position * entry_price) * 100 if entry_price else 0
            # Duration
            try:
                d1 = datetime.strptime(entry_date, "%Y-%m-%d")
                d2 = datetime.strptime(bar.date, "%Y-%m-%d")
                dur = (d2 - d1).days
            except Exception:
                dur = 0
            trades.append(Trade(
                entry_date=entry_date, exit_date=bar.date, symbol=symbol,
                side="LONG", qty=position, entry_price=round(entry_price, 4),
                exit_price=round(fill_price, 4), pnl=round(pnl, 4),
                pnl_pct=round(pnl_pct, 4), fees=round(fees, 4), duration_days=dur,
            ))
            position = 0

    # Close open position at last bar
    if position > 0 and bars:
        last = bars[-1]
        fill_price = last.close * (1 - slippage)
        gross = position * fill_price
        fees = gross * fee_rate + fixed_fee
        capital = gross - fees
        pnl = capital - position * entry_price
        pnl_pct = pnl / (position * entry_price) * 100 if entry_price else 0
        try:
            d1 = datetime.strptime(entry_date, "%Y-%m-%d")
            d2 = datetime.strptime(last.date, "%Y-%m-%d")
            dur = (d2 - d1).days
        except Exception:
            dur = 0
        trades.append(Trade(
            entry_date=entry_date, exit_date=last.date, symbol=symbol,
            side="LONG", qty=position, entry_price=round(entry_price, 4),
            exit_price=round(fill_price, 4), pnl=round(pnl, 4),
            pnl_pct=round(pnl_pct, 4), fees=round(fees, 4), duration_days=dur,
        ))

    final_capital = capital
    total_return = (final_capital - initial_capital) / initial_capital * 100

    # Annualized return
    n_days = len(bars)
    ann_return = ((final_capital / initial_capital) ** (365 / max(n_days, 1)) - 1) * 100 if n_days > 0 else 0

    # Sharpe/Sortino
    if len(equity_curve) > 1:
        daily_returns = [
            (equity_curve[i]["value"] - equity_curve[i-1]["value"]) / equity_curve[i-1]["value"]
            for i in range(1, len(equity_curve))
            if equity_curve[i-1]["value"] > 0
        ]
        if daily_returns:
            mean_r = sum(daily_returns) / len(daily_returns)
            std_r = math.sqrt(sum((r - mean_r) ** 2 for r in daily_returns) / len(daily_returns))
            sharpe = (mean_r / std_r * math.sqrt(252)) if std_r > 0 else 0
            down_r = [r for r in daily_returns if r < 0]
            std_down = math.sqrt(sum(r ** 2 for r in down_r) / len(down_r)) if down_r else std_r
            sortino = (mean_r / std_down * math.sqrt(252)) if std_down > 0 else 0
        else:
            sharpe = sortino = 0
    else:
        sharpe = sortino = 0

    calmar = ann_return / max_drawdown if max_drawdown > 0 else 0

    # Trade stats
    winning = [t for t in trades if t.pnl > 0]
    losing = [t for t in trades if t.pnl <= 0]
    win_rate = len(winning) / len(trades) * 100 if trades else 0
    gross_profit = sum(t.pnl for t in winning)
    gross_loss = abs(sum(t.pnl for t in losing))
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else float("inf")
    avg_trade = sum(t.pnl_pct for t in trades) / len(trades) if trades else 0
    avg_win = sum(t.pnl_pct for t in winning) / len(winning) if winning else 0
    avg_loss = sum(t.pnl_pct for t in losing) / len(losing) if losing else 0
    best = max((t.pnl_pct for t in trades), default=0)
    worst = min((t.pnl_pct for t in trades), default=0)
    avg_hold = sum(t.duration_days for t in trades) / len(trades) if trades else 0

    # Benchmark: buy & hold
    bh_return = (bars[-1].close - bars[0].close) / bars[0].close * 100 if bars else 0

    period_label = f"{bars[0].date} → {bars[-1].date}" if bars else ""

    return BacktestResult(
        strategy_name=strategy_name, symbol=symbol, period=period_label,
        initial_capital=initial_capital, final_capital=round(final_capital, 2),
        total_return_pct=round(total_return, 2),
        annualized_return_pct=round(ann_return, 2),
        max_drawdown_pct=round(max_drawdown, 2),
        sharpe_ratio=round(sharpe, 3), sortino_ratio=round(sortino, 3),
        calmar_ratio=round(calmar, 3), win_rate_pct=round(win_rate, 1),
        profit_factor=round(profit_factor, 3),
        total_trades=len(trades), winning_trades=len(winning), losing_trades=len(losing),
        avg_trade_pct=round(avg_trade, 2), avg_win_pct=round(avg_win, 2),
        avg_loss_pct=round(avg_loss, 2), best_trade_pct=round(best, 2),
        worst_trade_pct=round(worst, 2), avg_holding_days=round(avg_hold, 1),
        equity_curve=equity_curve, trades=[vars(t) for t in trades],
        benchmark_return_pct=round(bh_return, 2),
        parameters=strategy_params,
    )
