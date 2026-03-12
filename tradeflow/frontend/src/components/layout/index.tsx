"use client";
// src/components/layout/index.tsx
// Re-exports Sidebar, Topbar, TickerTape from single file
import { useState, useEffect } from "react";
import {
  LayoutDashboard, TrendingUp, Briefcase, BarChart2, Bell,
  BookOpen, FlaskConical, Star, Settings, Search, ChevronRight, Wifi, WifiOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePriceStore, useAuthStore } from "@/lib/store";
import type { Page } from "@/app/page";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { id: "market", label: "Marchés", Icon: TrendingUp },
  { id: "portfolio", label: "Portefeuille", Icon: Briefcase },
  { id: "analytics", label: "Analyse Risque", Icon: BarChart2 },
  { id: "backtest", label: "Backtesting", Icon: FlaskConical },
  { id: "alerts", label: "Alertes", Icon: Bell },
  { id: "journal", label: "Journal", Icon: BookOpen },
];

export function Sidebar({ activePage, onNavigate }: { activePage: Page; onNavigate: (p: Page) => void }) {
  const [time, setTime] = useState(new Date());
  const user = useAuthStore(s => s.user);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <aside className="w-52 min-w-52 bg-bg-2 border-r border-border flex flex-col overflow-y-auto">
      {/* Logo */}
      <div className="px-3.5 py-4 border-b border-border">
        <div className="text-[17px] font-bold tracking-tight">
          Trade<span className="text-blue">Flow</span>
          <span className="ml-1.5 text-[9px] font-mono text-green bg-green-dim px-1.5 py-0.5 rounded align-middle">DEMO</span>
        </div>
        <div className="text-[11px] font-mono text-text-3 mt-0.5">
          {time.toLocaleTimeString("fr-FR")}
        </div>
      </div>

      {/* Nav */}
      <div className="px-1.5 pt-2.5">
        <p className="text-[9px] font-semibold tracking-[1.5px] uppercase text-text-3 px-2 pb-1.5">Navigation</p>
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id as Page)}
            className={cn(
              "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium mb-0.5 transition-all cursor-pointer border-none text-left",
              activePage === id
                ? "bg-blue-dim text-blue"
                : "text-text-2 hover:bg-bg-card hover:text-text-1"
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Watchlists */}
      <div className="px-1.5 pt-3">
        <p className="text-[9px] font-semibold tracking-[1.5px] uppercase text-text-3 px-2 pb-1.5">Watchlists</p>
        {["Tech US", "CAC 40", "Crypto"].map(wl => (
          <button
            key={wl}
            onClick={() => onNavigate("market")}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium mb-0.5 text-text-2 hover:bg-bg-card hover:text-text-1 transition-all cursor-pointer border-none text-left"
          >
            <Star size={13} />
            {wl}
          </button>
        ))}
      </div>

      {/* Bottom */}
      <div className="mt-auto border-t border-border px-1.5 py-2">
        <button className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[12px] text-text-2 hover:bg-bg-card hover:text-text-1 transition-all cursor-pointer border-none text-left">
          <Settings size={14} />
          Paramètres
        </button>
        <div className="px-2.5 py-1.5 mt-0.5">
          <div className="text-[12px] font-semibold text-text-2">{user?.full_name || user?.username || "Thomas Dupont"}</div>
          <div className="text-[10px] font-mono text-text-3">{user?.email || "thomas@example.com"}</div>
        </div>
      </div>
    </aside>
  );
}

export function Topbar({ onNavigate }: { onNavigate: (p: Page, symbol?: string) => void }) {
  const connected = usePriceStore(s => s.connected);
  const [search, setSearch] = useState("");

  return (
    <div className="h-12 bg-bg-2 border-b border-border flex items-center px-4 gap-3 flex-shrink-0">
      <div className="flex items-center gap-2 bg-bg-card border border-border rounded-md px-3 py-1.5 w-64">
        <Search size={13} className="text-text-3 flex-shrink-0" />
        <input
          placeholder="AAPL, BTC, LVMH..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && search.trim()) {
              onNavigate("asset", search.trim().toUpperCase());
              setSearch("");
            }
          }}
          className="bg-none border-none outline-none text-text-1 text-[12px] font-sans w-full bg-transparent"
        />
      </div>
      <div className="ml-auto flex items-center gap-2.5">
        <div className="flex items-center gap-1.5 bg-bg-card border border-border rounded px-2.5 py-1 text-[10px] font-mono text-text-2">
          <div className={cn("w-1.5 h-1.5 rounded-full pulse-dot", connected ? "bg-green" : "bg-red")} />
          {connected ? "Live" : "Déconnecté"} · DEMO
        </div>
        <div className="text-[11px] text-text-3 font-mono">
          {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
        </div>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue to-purple flex items-center justify-center text-[11px] font-bold cursor-pointer">
          TD
        </div>
      </div>
    </div>
  );
}

export function TickerTape() {
  const prices = usePriceStore(s => s.prices);
  const SYMS = ["AAPL", "MSFT", "NVDA", "TSLA", "GOOGL", "SPY", "BTC-USD", "MC.PA", "TTE.PA"];
  const items = SYMS.map(s => ({ sym: s, ...prices[s] })).filter(i => i.price);
  const display = [...items, ...items]; // duplicate for seamless loop

  if (items.length === 0) return null;

  return (
    <div className="h-8 bg-bg-2 border-b border-border overflow-hidden flex items-center">
      <div className="flex gap-9 ticker-anim whitespace-nowrap px-5">
        {display.map((it, i) => (
          <span key={i} className="flex items-center gap-1.5 text-[11px] font-mono">
            <span className="font-semibold text-text-1">{it.sym}</span>
            <span className={(it.change_pct ?? 0) >= 0 ? "text-green" : "text-red"}>
              {it.price?.toFixed(2)} {" "}
              <span className="text-[9px] opacity-70">
                {(it.change_pct ?? 0) >= 0 ? "▲" : "▼"} {Math.abs(it.change_pct ?? 0).toFixed(2)}%
              </span>
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
