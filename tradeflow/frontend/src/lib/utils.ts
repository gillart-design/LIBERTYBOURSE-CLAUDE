// src/lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fmt2 = (n: number | null | undefined) =>
  n == null ? "--" : n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtPct = (n: number) =>
  `${n >= 0 ? "+" : ""}${fmt2(n)}%`;

export const fmtCompact = (n: number) => {
  if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(1) + "T";
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(2);
};

export const ASSET_COLORS: Record<string, string> = {
  AAPL: "#3b82f6", MSFT: "#8b5cf6", NVDA: "#10b981", TSLA: "#ef4444",
  GOOGL: "#f59e0b", AMZN: "#06b6d4", META: "#3b82f6", SPY: "#8b5cf6",
  QQQ: "#06b6d4", "BTC-USD": "#f59e0b", "ETH-USD": "#8b5cf6",
  "MC.PA": "#d4af37", "TTE.PA": "#f97316", "AIR.PA": "#06b6d4",
};

export const getColor = (symbol: string) => ASSET_COLORS[symbol] ?? "#3b82f6";

export const SECTOR_COLORS: Record<string, string> = {
  Technology: "#3b82f6", "Consumer Cyclical": "#ef4444", "Communication Services": "#f59e0b",
  "Consumer Defensive": "#d4af37", Energy: "#f97316", Industrials: "#06b6d4",
  ETF: "#8b5cf6", Cryptocurrency: "#f59e0b", Healthcare: "#10b981",
};
