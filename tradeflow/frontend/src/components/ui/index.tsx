// src/components/ui/index.tsx
"use client";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

// ── Card ────────────────────────────────────────────────────────
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("bg-bg-card border border-border rounded-lg p-3.5", className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-[10px] font-semibold text-text-3 uppercase tracking-widest mb-3", className)}>
      {children}
    </p>
  );
}

// ── Metric Card ─────────────────────────────────────────────────
interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  chip?: { label: string; up: boolean };
}
export function MetricCard({ label, value, sub, color, chip }: MetricCardProps) {
  return (
    <Card>
      <p className="text-[10px] text-text-3 uppercase tracking-wider font-medium mb-1.5">{label}</p>
      <p className={cn("text-xl font-bold font-num tracking-tight", color)}>{value}</p>
      {chip && (
        <span className={cn("mt-1.5 inline-flex text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded",
          chip.up ? "bg-green-dim text-green" : "bg-red-dim text-red"
        )}>
          {chip.up ? "▲" : "▼"} {chip.label}
        </span>
      )}
      {sub && <p className="mt-1 text-[11px] text-text-3">{sub}</p>}
    </Card>
  );
}

// ── Chip / Badge ────────────────────────────────────────────────
export function Chip({ value, pct = false }: { value: number; pct?: boolean }) {
  const pos = value >= 0;
  const fmt = pct
    ? `${pos ? "+" : ""}${value.toFixed(2)}%`
    : `${pos ? "+" : ""}${value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded",
      pos ? "bg-green-dim text-green" : "bg-red-dim text-red"
    )}>
      {pos ? "▲" : "▼"} {fmt}
    </span>
  );
}

export function Badge({ children, color = "blue" }: { children: ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-dim text-blue",
    green: "bg-green-dim text-green",
    red: "bg-red-dim text-red",
    yellow: "bg-yellow/10 text-yellow",
    gray: "bg-border text-text-3",
  };
  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold", colors[color] || colors.blue)}>
      {children}
    </span>
  );
}

// ── Button ──────────────────────────────────────────────────────
interface BtnProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "buy" | "sell" | "danger";
  size?: "sm" | "md";
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  loading?: boolean;
}
export function Btn({ children, onClick, variant = "ghost", size = "md", className, type = "button", disabled, loading }: BtnProps) {
  const base = "inline-flex items-center gap-1.5 font-semibold rounded-md cursor-pointer border-none font-sans transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = { sm: "px-2.5 py-1 text-[11px]", md: "px-3 py-1.5 text-[12px]" };
  const variants = {
    primary: "bg-blue text-white hover:bg-blue/80",
    ghost: "bg-transparent text-text-2 border border-border hover:bg-bg-hover hover:text-text-1",
    buy: "bg-green text-white hover:bg-green/80",
    sell: "bg-red text-white hover:bg-red/80",
    danger: "bg-red-dim text-red hover:bg-red/20",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(base, sizes[size], variants[variant], className)}
    >
      {loading ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : children}
    </button>
  );
}

// ── Input ───────────────────────────────────────────────────────
interface InputProps {
  label?: string;
  type?: string;
  placeholder?: string;
  value?: string | number;
  onChange?: (v: string) => void;
  className?: string;
  min?: number;
  step?: number;
}
export function Input({ label, type = "text", placeholder, value, onChange, className, min, step }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-[10px] font-semibold text-text-2 uppercase tracking-wider">{label}</label>}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        min={min}
        step={step}
        className={cn("w-full bg-bg-2 border border-border rounded-md px-3 py-1.5 text-text-1 text-[12px] font-sans outline-none focus:border-blue transition-colors", className)}
      />
    </div>
  );
}

export function Select({ label, value, onChange, options, className }: {
  label?: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; className?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-[10px] font-semibold text-text-2 uppercase tracking-wider">{label}</label>}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={cn("w-full bg-bg-2 border border-border rounded-md px-3 py-1.5 text-text-1 text-[12px] font-sans outline-none focus:border-blue transition-colors cursor-pointer", className)}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ── Tabs ────────────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange }: {
  tabs: string[]; active: string; onChange: (t: string) => void;
}) {
  return (
    <div className="flex gap-0.5 bg-bg-2 p-0.5 rounded-md">
      {tabs.map(t => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={cn(
            "px-3 py-1 rounded text-[11px] font-medium transition-all cursor-pointer border-none font-sans",
            active === t ? "bg-bg-card text-text-1" : "bg-transparent text-text-2 hover:text-text-1"
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// ── Table ───────────────────────────────────────────────────────
export function Table({ headers, children, className }: {
  headers: string[]; children: ReactNode; className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-text-3 uppercase tracking-wider border-b border-border">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function TR({ children, onClick, className }: { children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <tr
      onClick={onClick}
      className={cn("border-b border-border last:border-0 hover:bg-bg-hover transition-colors", onClick && "cursor-pointer", className)}
    >
      {children}
    </tr>
  );
}

export function TD({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("px-3 py-2.5 text-[12px]", className)}>{children}</td>;
}

// ── Asset Icon ──────────────────────────────────────────────────
export function AssetIcon({ symbol, color, size = "md" }: { symbol: string; color: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-6 h-6 text-[8px] rounded", md: "w-8 h-8 text-[9px] rounded-lg", lg: "w-11 h-11 text-[11px] rounded-xl" };
  return (
    <div
      className={cn("flex items-center justify-center font-bold flex-shrink-0", sizes[size])}
      style={{ background: `${color}22`, color }}
    >
      {symbol.replace(/[^A-Z]/g, "").slice(0, 3) || symbol.slice(0, 3).toUpperCase()}
    </div>
  );
}

// ── Stat Row ────────────────────────────────────────────────────
export function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-border last:border-0">
      <span className="text-[12px] text-text-2">{label}</span>
      <span className={cn("text-[12px] font-semibold font-num", color)}>{value}</span>
    </div>
  );
}

// ── Section Bar ─────────────────────────────────────────────────
export function SectorBar({ name, pct, color }: { name: string; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <span className="w-24 text-[11px] text-text-2 flex-shrink-0">{name}</span>
      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[11px] font-num text-text-2 w-8 text-right">{pct}%</span>
    </div>
  );
}

// ── Page Header ─────────────────────────────────────────────────
export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-[19px] font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="text-[12px] text-text-2 mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ── Sparkline SVG ───────────────────────────────────────────────
export function Sparkline({ data, up, width = 80, height = 28 }: {
  data: number[]; up?: boolean; width?: number; height?: number;
}) {
  if (!data || data.length < 2) return null;
  const mn = Math.min(...data), mx = Math.max(...data), rng = mx - mn || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - mn) / rng) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  const color = (up ?? data[data.length - 1] >= data[0]) ? "#10b981" : "#ef4444";
  return (
    <svg width={width} height={height} style={{ flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

// ── Pct Bar ─────────────────────────────────────────────────────
export function PctBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div>
      <div className="h-[3px] bg-border rounded-full overflow-hidden mt-1">
        <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
    </div>
  );
}

// ── Loading Spinner ──────────────────────────────────────────────
export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const s = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-10 h-10" };
  return (
    <div className={cn("border-2 border-border border-t-blue rounded-full animate-spin", s[size])} />
  );
}

// ── Empty State ─────────────────────────────────────────────────
export function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="text-[14px] font-semibold text-text-2 mb-1">{title}</p>
      {subtitle && <p className="text-[12px] text-text-3">{subtitle}</p>}
    </div>
  );
}
