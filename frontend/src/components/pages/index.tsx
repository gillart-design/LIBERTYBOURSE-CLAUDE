"use client";
// src/components/pages/index.tsx — All page components
import { useState, useMemo } from "react";
import { RefreshCw, Plus, Trash2, ArrowLeft, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine
} from "recharts";
import {
  Card, CardTitle, MetricCard, Chip, Badge, Btn, Input, Select, Tabs,
  Table, TR, TD, AssetIcon, StatRow, SectorBar, PageHeader, Sparkline,
  PctBar, Spinner, EmptyState
} from "@/components/ui";
import { fmt2, fmtPct, fmtCompact, getColor } from "@/lib/utils";
import {
  usePortfolios, usePortfolio, useOrderHistory, usePlaceOrder,
  useHistory, useQuotes, useAlerts, useCreateAlert, useDeleteAlert,
  useJournal, useStrategies, useRunBacktest, useProviderInfo
} from "@/lib/hooks";
import { usePriceStore } from "@/lib/store";
import type { Page } from "@/app/page";

// ── Custom Recharts Tooltip ────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg-card border border-border-light rounded-md px-3 py-2 text-[11px] font-mono">
      <p className="text-text-3 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {fmt2(p.value)}</p>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════
export function Dashboard({ onNavigate }: { onNavigate: (p: Page, s?: string) => void }) {
  const { data: portfolios, isLoading } = usePortfolios();
  const portfolio = portfolios?.[0];
  const [tab, setTab] = useState("3M");
  const providerInfo = useProviderInfo();

  const pfChartData = useMemo(() => {
    const days = tab === "1M" ? 30 : tab === "3M" ? 90 : tab === "6M" ? 180 : tab === "YTD" ? 80 : 365;
    let pf = 44000, sp = 43000;
    return Array.from({ length: days }, (_, i) => {
      pf *= (1 + (Math.random() - 0.47) * 0.018);
      sp *= (1 + (Math.random() - 0.47) * 0.015);
      const d = new Date(); d.setDate(d.getDate() - (days - i));
      return { date: d.toISOString().slice(5), portfolio: +pf.toFixed(0), benchmark: +sp.toFixed(0) };
    });
  }, [tab]);

  const sectors = [
    { name: "Technologie", pct: 48, color: "#3b82f6" },
    { name: "ETF", pct: 22, color: "#10b981" },
    { name: "Crypto", pct: 14, color: "#f59e0b" },
    { name: "Luxe", pct: 10, color: "#d4af37" },
    { name: "Liquidités", pct: 6, color: "#4a5568" },
  ];

  if (isLoading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  const pf = portfolio;
  const totalPnlPct = pf ? (pf.total_pnl / pf.initial_cash * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <PageHeader title="Tableau de Bord" subtitle={`${pf?.name || "Portfolio"} · Données ${providerInfo.data?.active_provider || "demo"}`} />
        {providerInfo.data && (
          <Badge color={providerInfo.data.is_live ? "green" : "yellow"}>
            {providerInfo.data.active_provider} · {providerInfo.data.is_live ? "LIVE" : "15min delay"}
          </Badge>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-2.5">
        <MetricCard label="Valeur Totale" value={`${fmt2(pf?.total_value)} €`}
          chip={{ label: "+8.34% ce mois", up: true }} />
        <MetricCard label="P&L Total"
          value={`${(pf?.total_pnl ?? 0) >= 0 ? "+" : ""}${fmt2(pf?.total_pnl)} €`}
          color={(pf?.total_pnl ?? 0) >= 0 ? "text-green" : "text-red"}
          chip={{ label: fmtPct(totalPnlPct), up: totalPnlPct >= 0 }} />
        <MetricCard label="Liquidités" value={`${fmt2(pf?.cash)} €`}
          sub={`${fmt2((pf?.cash ?? 0) / (pf?.total_value || 1) * 100)}% du portf.`} />
        <MetricCard label="Positions" value={String(pf?.positions?.length ?? 0)}
          sub={`${pf?.positions?.length ?? 0} actifs différents`} />
      </div>

      {/* Chart + Sectors */}
      <div className="grid grid-cols-[1fr_270px] gap-3">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <CardTitle className="mb-0">Performance vs Benchmark</CardTitle>
            <Tabs tabs={["1M", "3M", "6M", "YTD", "1A"]} active={tab} onChange={setTab} />
          </div>
          <div className="flex gap-4 mb-2">
            <span className="text-[11px] text-text-2 flex items-center gap-1.5">
              <span className="inline-block w-4 h-0.5 bg-blue" /> Portfolio
            </span>
            <span className="text-[11px] text-text-2 flex items-center gap-1.5">
              <span className="inline-block w-4 h-0 border-t border-dashed border-purple" /> S&P 500
            </span>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={pfChartData}>
              <defs>
                <linearGradient id="gPf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2336" />
              <XAxis dataKey="date" tick={{ fill: "#4a5568", fontSize: 9 }} tickLine={false} />
              <YAxis tick={{ fill: "#4a5568", fontSize: 9 }} tickLine={false} tickFormatter={v => fmtCompact(v)} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="portfolio" name="Portfolio" stroke="#3b82f6" strokeWidth={2} fill="url(#gPf)" />
              <Line type="monotone" dataKey="benchmark" name="S&P 500" stroke="#8b5cf6" strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <div className="flex items-center justify-between mb-3">
            <CardTitle className="mb-0">Allocation</CardTitle>
            <Btn size="sm" onClick={() => onNavigate("portfolio")}>Gérer</Btn>
          </div>
          {sectors.map(s => <SectorBar key={s.name} {...s} />)}
          <div className="h-px bg-border my-2.5" />
          {[["Sharpe", "1.42", "text-green"], ["MaxDD", "-12.8%", "text-red"], ["Volatilité", "16.3%", "text-yellow"], ["Bêta", "1.08", "text-text-2"]].map(([l, v, c]) => (
            <StatRow key={l} label={l} value={v} color={c} />
          ))}
        </Card>
      </div>

      {/* Market + Positions */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-0">
          <div className="flex items-center justify-between px-3.5 py-3 border-b border-border">
            <CardTitle className="mb-0">Marchés · Top Mouvements</CardTitle>
            <Btn size="sm" onClick={() => onNavigate("market")}>Explorer</Btn>
          </div>
          <Table headers={["Actif", "Prix", "Var %", "30j"]}>
            {(pf?.positions ?? []).slice(0, 6).map((pos: any) => {
              const sparkData = Array.from({ length: 20 }, (_, i) =>
                pos.current_price * (1 + (Math.random() - 0.48) * 0.02 * i));
              return (
                <TR key={pos.symbol} onClick={() => onNavigate("asset", pos.symbol)}>
                  <TD>
                    <div className="flex items-center gap-2">
                      <AssetIcon symbol={pos.symbol} color={getColor(pos.symbol)} />
                      <div>
                        <div className="font-semibold text-[12px]">{pos.symbol}</div>
                      </div>
                    </div>
                  </TD>
                  <TD className="font-num font-semibold">{fmt2(pos.current_price)}</TD>
                  <TD><Chip value={pos.unrealized_pnl_pct} pct /></TD>
                  <TD><Sparkline data={sparkData} up={pos.unrealized_pnl >= 0} /></TD>
                </TR>
              );
            })}
          </Table>
        </Card>
        <Card className="p-0">
          <div className="flex items-center justify-between px-3.5 py-3 border-b border-border">
            <CardTitle className="mb-0">Mes Positions</CardTitle>
            <Btn size="sm" onClick={() => onNavigate("portfolio")}>Détails</Btn>
          </div>
          <Table headers={["Actif", "Valeur", "P&L", "Poids"]}>
            {(pf?.positions ?? []).slice(0, 6).map((pos: any) => (
              <TR key={pos.symbol} onClick={() => onNavigate("asset", pos.symbol)}>
                <TD>
                  <div className="flex items-center gap-2">
                    <AssetIcon symbol={pos.symbol} color={getColor(pos.symbol)} size="sm" />
                    <span className="font-semibold text-[12px]">{pos.symbol}</span>
                  </div>
                </TD>
                <TD className="font-num text-[12px]">{fmt2(pos.market_value)} €</TD>
                <TD><Chip value={pos.unrealized_pnl} /></TD>
                <TD>
                  <span className="text-[10px] font-num text-text-2">{pos.weight_pct}%</span>
                  <PctBar pct={pos.weight_pct} color={getColor(pos.symbol)} />
                </TD>
              </TR>
            ))}
          </Table>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MARKET PAGE
// ═══════════════════════════════════════════════════════════════
const SYMBOLS = ["AAPL", "MSFT", "NVDA", "TSLA", "GOOGL", "AMZN", "META", "MC.PA", "TTE.PA", "AIR.PA", "SPY", "BTC-USD"];
const SECTORS = ["Tous", "Technology", "ETF", "Cryptocurrency", "Consumer Cyclical", "Communication Services"];
const INDICES = [
  { sym: "CAC 40", price: 7842.34, chgPct: 1.12 },
  { sym: "S&P 500", price: 5248.49, chgPct: 0.67 },
  { sym: "NASDAQ", price: 16421.20, chgPct: 0.94 },
  { sym: "DAX", price: 18234.85, chgPct: -0.23 },
];

export function MarketPage({ onNavigate }: { onNavigate: (p: Page, s?: string) => void }) {
  const [q, setQ] = useState("");
  const [sec, setSec] = useState("Tous");
  const prices = usePriceStore(s => s.prices);
  const { data: quotesData } = useQuotes(SYMBOLS);

  const items = SYMBOLS.map(sym => ({
    symbol: sym, color: getColor(sym),
    ...(prices[sym] || quotesData?.find((d: any) => d.symbol === sym) || {}),
  })).filter(i => !q || i.symbol.includes(q.toUpperCase()));

  return (
    <div className="space-y-3">
      <PageHeader title="Marchés" subtitle="Explorez et analysez les actifs disponibles" />
      <div className="grid grid-cols-4 gap-2.5">
        {INDICES.map(idx => (
          <MetricCard key={idx.sym} label={idx.sym}
            value={fmt2(idx.price)}
            chip={{ label: fmtPct(idx.chgPct), up: idx.chgPct >= 0 }} />
        ))}
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        <input
          placeholder="🔍 AAPL, BTC..."
          value={q} onChange={e => setQ(e.target.value)}
          className="bg-bg-card border border-border rounded-md px-3 py-1.5 text-[12px] outline-none focus:border-blue w-52 text-text-1"
        />
        {SECTORS.map(s => (
          <Btn key={s} size="sm" variant={sec === s ? "primary" : "ghost"} onClick={() => setSec(s)}>{s}</Btn>
        ))}
      </div>
      <Card className="p-0">
        <Table headers={["Actif", "Prix", "Variation", "Var %", "Volume", "30j", ""]}>
          {items.map((it: any) => {
            const sparkData = Array.from({ length: 20 }, (_, i) =>
              (it.price || 100) * (1 + (Math.random() - 0.48) * 0.02 * i));
            return (
              <TR key={it.symbol} onClick={() => onNavigate("asset", it.symbol)}>
                <TD>
                  <div className="flex items-center gap-2">
                    <AssetIcon symbol={it.symbol} color={it.color} />
                    <div>
                      <div className="font-semibold">${it.symbol}</div>
                      <div className="text-[10px] text-text-3">{it.name || it.symbol}</div>
                    </div>
                  </div>
                </TD>
                <TD className="font-num font-semibold">{fmt2(it.price)}</TD>
                <TD className={`font-num ${(it.change || 0) >= 0 ? "text-green" : "text-red"}`}>
                  {(it.change || 0) >= 0 ? "+" : ""}{fmt2(it.change)}
                </TD>
                <TD><Chip value={it.change_pct || 0} pct /></TD>
                <TD className="font-num text-[11px] text-text-2">{it.volume ? fmtCompact(it.volume) : "--"}</TD>
                <TD><Sparkline data={sparkData} up={(it.change_pct || 0) >= 0} /></TD>
                <TD>
                  <Btn size="sm" variant="primary" onClick={e => { e.stopPropagation(); onNavigate("asset", it.symbol); }}>
                    Analyser
                  </Btn>
                </TD>
              </TR>
            );
          })}
        </Table>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ASSET DETAIL
// ═══════════════════════════════════════════════════════════════
export function AssetDetailPage({ symbol, onBack }: { symbol: string; onBack: () => void }) {
  const [period, setPeriod] = useState("6M");
  const [showOrder, setShowOrder] = useState(false);
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [qty, setQty] = useState("");
  const [orderType, setOrderType] = useState("MARKET");
  const { data: histData, isLoading } = useHistory(symbol, period.toLowerCase().replace("a", "y"));
  const livePrice = usePriceStore(s => s.prices[symbol]);
  const { data: portfolios } = usePortfolios();
  const placeOrder = usePlaceOrder();

  const price = livePrice?.price || 0;
  const change = livePrice?.change || 0;
  const changePct = livePrice?.change_pct || 0;
  const color = getColor(symbol);

  const chartData = (histData?.bars || []).map((b: any) => ({ ...b, value: b.close }));

  const handleOrder = async () => {
    const q = parseFloat(qty);
    if (!q || q <= 0 || !portfolios?.[0]) return;
    try {
      const result = await placeOrder.mutateAsync({
        portfolio_id: portfolios[0].id, symbol, side,
        order_type: orderType, quantity: q,
      });
      alert(`✓ Ordre ${side} exécuté!\n${q} ${symbol} @ ${fmt2(result.filled_price)}\nFrais: ${fmt2(result.fees)} €\nTotal: ${fmt2(result.total)} €`);
      setShowOrder(false); setQty("");
    } catch (err: any) {
      alert("Erreur: " + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <Btn size="sm" onClick={onBack} className="mb-3"><ArrowLeft size={13} /> Retour</Btn>
          <div className="flex items-center gap-3">
            <AssetIcon symbol={symbol} color={color} size="lg" />
            <div>
              <h1 className="text-[20px] font-bold">{symbol}</h1>
              <p className="text-[12px] text-text-2 font-mono">{symbol} · USD</p>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[28px] font-bold font-num tracking-tight">{fmt2(price)}</div>
          <Chip value={changePct} pct />
          <div className="flex gap-2 mt-2.5 justify-end">
            <Btn variant="buy" onClick={() => { setSide("BUY"); setShowOrder(true); }}>
              <TrendingUp size={13} /> Acheter
            </Btn>
            <Btn variant="sell" onClick={() => { setSide("SELL"); setShowOrder(true); }}>
              <TrendingDown size={13} /> Vendre
            </Btn>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-2">
        {[
          ["Ouverture", fmt2(livePrice?.open)],
          ["+ Haut", fmt2(livePrice?.high)],
          ["+ Bas", fmt2(livePrice?.low)],
          ["Volume", livePrice?.volume ? fmtCompact(livePrice.volume) : "--"],
          ["Clôture préc.", fmt2(livePrice?.prev_close)],
        ].map(([l, v]) => (
          <Card key={l} className="py-2.5 px-3">
            <div className="text-[10px] text-text-3 uppercase tracking-wider mb-1">{l}</div>
            <div className="font-semibold font-num text-[13px]">{v}</div>
          </Card>
        ))}
      </div>

      {/* Price chart */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <CardTitle className="mb-0">Graphique des Prix</CardTitle>
          <Tabs tabs={["1D", "5D", "1M", "3M", "6M", "1A"]} active={period} onChange={setPeriod} />
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center h-52"><Spinner /></div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2336" />
              <XAxis dataKey="date" tick={{ fill: "#4a5568", fontSize: 9 }} tickLine={false} />
              <YAxis tick={{ fill: "#4a5568", fontSize: 9 }} tickLine={false} tickFormatter={v => fmt2(v)} domain={["auto", "auto"]} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="close" name="Prix" stroke={color} strokeWidth={2} fill="url(#ga)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Volume */}
      <Card>
        <CardTitle>Volume</CardTitle>
        <ResponsiveContainer width="100%" height={65}>
          <BarChart data={chartData.slice(-90)}>
            <Bar dataKey="volume" fill="#1e2336" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Order modal */}
      {showOrder && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={e => e.target === e.currentTarget && setShowOrder(false)}>
          <div className="bg-bg-card border border-border-light rounded-xl p-5 w-[400px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-bold">{side === "BUY" ? "📈 Acheter" : "📉 Vendre"} {symbol}</h3>
              <Btn size="sm" onClick={() => setShowOrder(false)}>✕</Btn>
            </div>
            <div className="flex gap-2 mb-4">
              <Btn variant={side === "BUY" ? "buy" : "ghost"} className="flex-1 justify-center" onClick={() => setSide("BUY")}>▲ Acheter</Btn>
              <Btn variant={side === "SELL" ? "sell" : "ghost"} className="flex-1 justify-center" onClick={() => setSide("SELL")}>▼ Vendre</Btn>
            </div>
            <div className="space-y-3 mb-4">
              <Select label="Type d'ordre" value={orderType} onChange={setOrderType}
                options={[{ value: "MARKET", label: "Au Marché" }, { value: "LIMIT", label: "Limite" }, { value: "STOP", label: "Stop" }]} />
              <Input label="Quantité" type="number" placeholder="ex: 10" value={qty} onChange={setQty} min={0.001} step={0.001} />
            </div>
            {qty && parseFloat(qty) > 0 && (
              <div className="bg-bg-2 border border-border rounded-md p-3 mb-4 space-y-1.5">
                {[["Sous-total", fmt2(parseFloat(qty) * price) + " €"],
                  ["Frais (0.1%)", fmt2(parseFloat(qty) * price * 0.001 + 1) + " €"],
                  ["Total", fmt2(parseFloat(qty) * price * 1.001 + 1) + " €"]].map(([l, v], i) => (
                  <div key={l} className={`flex justify-between ${i === 2 ? "font-bold text-[13px] border-t border-border pt-1.5 mt-1" : ""}`}>
                    <span className="text-text-2 text-[12px]">{l}</span>
                    <span className={`font-num font-semibold ${i === 2 ? (side === "BUY" ? "text-green" : "text-red") : ""}`}>{v}</span>
                  </div>
                ))}
              </div>
            )}
            <Btn variant={side === "BUY" ? "buy" : "sell"} className="w-full justify-center py-2.5 text-[13px]"
              onClick={handleOrder} loading={placeOrder.isPending}>
              {side === "BUY" ? "✓ Confirmer l'achat" : "✓ Confirmer la vente"}
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PORTFOLIO
// ═══════════════════════════════════════════════════════════════
export function PortfolioPage({ onNavigate }: { onNavigate: (p: Page, s?: string) => void }) {
  const { data: portfolios, isLoading } = usePortfolios();
  const portfolio = portfolios?.[0];
  const { data: orders } = useOrderHistory(portfolio?.id ?? null);
  const [tab, setTab] = useState("positions");

  const METRICS = [
    { l: "Rendement Total", v: "+18.4%", c: "text-green" }, { l: "Rendement Ann.", v: "+14.2%", c: "text-green" },
    { l: "Volatilité", v: "16.3%", c: "text-yellow" }, { l: "Sharpe", v: "1.42", c: "text-blue" },
    { l: "Sortino", v: "1.87", c: "text-blue" }, { l: "Max DD", v: "-12.8%", c: "text-red" },
    { l: "Bêta S&P 500", v: "1.08", c: "text-purple" }, { l: "Alpha", v: "+4.2%", c: "text-green" },
    { l: "Win Rate", v: "68%", c: "text-green" }, { l: "Profit Factor", v: "2.14", c: "text-green" },
    { l: "Transactions", v: String(orders?.length ?? 0), c: "text-text-2" }, { l: "P&L Réalisé", v: "+513 €", c: "text-green" },
  ];

  if (isLoading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;
  const pf = portfolio;
  const totalPnlPct = pf ? (pf.total_pnl / pf.initial_cash * 100) : 0;

  return (
    <div className="space-y-3">
      <PageHeader title="Portefeuille" subtitle="Paper Trading · Positions en temps réel" />
      <div className="grid grid-cols-4 gap-2.5">
        <MetricCard label="Valeur Totale" value={`${fmt2(pf?.total_value)} €`} color="text-blue" sub="Positions + Cash" />
        <MetricCard label="P&L Latent" value={`${(pf?.total_pnl ?? 0) >= 0 ? "+" : ""}${fmt2(pf?.total_pnl)} €`}
          color={(pf?.total_pnl ?? 0) >= 0 ? "text-green" : "text-red"} sub={fmtPct(totalPnlPct)} />
        <MetricCard label="Investi" value={`${fmt2(pf?.invested)} €`} color="text-purple" sub={`${fmt2(100 - (pf?.cash ?? 0) / (pf?.total_value || 1) * 100)}% du ptf`} />
        <MetricCard label="Liquidités" value={`${fmt2(pf?.cash)} €`} color="text-yellow" sub="Disponible immédiatement" />
      </div>

      <div className="grid grid-cols-[1fr_250px] gap-3">
        <Card className="p-0">
          <div className="flex items-center justify-between px-3.5 py-3 border-b border-border">
            <CardTitle className="mb-0">Positions & Historique</CardTitle>
            <Tabs tabs={["Positions", "Historique"]} active={tab} onChange={setTab} />
          </div>
          {tab === "Positions" ? (
            <Table headers={["Actif", "Qté", "Px Moy", "Px Act.", "Valeur", "P&L", "P&L%", "Poids"]}>
              {(pf?.positions ?? []).map((pos: any) => (
                <TR key={pos.symbol} onClick={() => onNavigate("asset", pos.symbol)}>
                  <TD>
                    <div className="flex items-center gap-2">
                      <AssetIcon symbol={pos.symbol} color={getColor(pos.symbol)} size="sm" />
                      <div>
                        <div className="font-semibold text-[12px]">{pos.symbol}</div>
                      </div>
                    </div>
                  </TD>
                  <TD className="font-num text-[12px]">{pos.quantity}</TD>
                  <TD className="font-num text-[12px]">{fmt2(pos.avg_cost)}</TD>
                  <TD className="font-num font-semibold text-[12px]">{fmt2(pos.current_price)}</TD>
                  <TD className="font-num font-semibold text-[12px]">{fmt2(pos.market_value)} €</TD>
                  <TD className={`font-num text-[12px] ${pos.unrealized_pnl >= 0 ? "text-green" : "text-red"}`}>
                    {pos.unrealized_pnl >= 0 ? "+" : ""}{fmt2(pos.unrealized_pnl)}€
                  </TD>
                  <TD><Chip value={pos.unrealized_pnl_pct} pct /></TD>
                  <TD>
                    <span className="text-[10px] font-num text-text-2">{pos.weight_pct}%</span>
                    <PctBar pct={pos.weight_pct} color={getColor(pos.symbol)} />
                  </TD>
                </TR>
              ))}
            </Table>
          ) : (
            <Table headers={["Date", "Actif", "Sens", "Qté", "Prix", "Frais", "Total"]}>
              {(orders ?? []).slice(0, 20).map((o: any) => (
                <TR key={o.id}>
                  <TD className="font-mono text-[11px] text-text-3">{o.date?.slice(0, 10)}</TD>
                  <TD className="font-semibold text-[12px]">{o.symbol}</TD>
                  <TD><Badge color={o.side === "BUY" ? "green" : "red"}>{o.side}</Badge></TD>
                  <TD className="font-num text-[12px]">{o.quantity}</TD>
                  <TD className="font-num text-[12px]">{fmt2(o.filled_price)}</TD>
                  <TD className="font-num text-[11px] text-text-2">{fmt2(o.fees)} €</TD>
                  <TD className="font-num font-semibold text-[12px]">{fmt2(o.total)} €</TD>
                </TR>
              ))}
            </Table>
          )}
        </Card>
        <Card>
          <CardTitle>Métriques Perf.</CardTitle>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {METRICS.map(m => (
              <div key={m.l}>
                <div className="text-[9px] text-text-3 uppercase tracking-wider mb-0.5">{m.l}</div>
                <div className={`text-[14px] font-bold font-num ${m.c}`}>{m.v}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════
export function AnalyticsPage() {
  const ddData = useMemo(() => {
    let peak = 45000;
    return Array.from({ length: 90 }, (_, i) => {
      const v = 45000 + Math.sin(i * .12) * 4000 + i * 250 + Math.random() * 800;
      peak = Math.max(peak, v);
      const d = new Date(); d.setDate(d.getDate() - (90 - i));
      return { date: d.toISOString().slice(5), dd: -((peak - v) / peak * 100) };
    });
  }, []);

  return (
    <div className="space-y-3">
      <PageHeader title="Analyse & Risque" subtitle="Métriques avancées — VaR, Stress Tests, Drawdown" />
      <div className="grid grid-cols-4 gap-2.5">
        {[
          { l: "VaR 95% (1j)", v: "-1 842 €", s: "-3.4% de la valeur", c: "text-red" },
          { l: "VaR 99% (1j)", v: "-2 614 €", s: "-4.8% de la valeur", c: "text-red" },
          { l: "CVaR / ES", v: "-3 102 €", s: "Expected Shortfall 95%", c: "text-red" },
          { l: "Concentration max", v: "28.5%", s: "AAPL · seuil 30%", c: "text-yellow" },
        ].map(m => <MetricCard key={m.l} label={m.l} value={m.v} sub={m.s} color={m.c} />)}
      </div>
      <Card>
        <CardTitle>Courbe de Drawdown (90 jours)</CardTitle>
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart data={ddData}>
            <defs>
              <linearGradient id="gDD" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2336" />
            <XAxis dataKey="date" tick={{ fill: "#4a5568", fontSize: 9 }} />
            <YAxis tick={{ fill: "#4a5568", fontSize: 9 }} tickFormatter={v => v.toFixed(1) + "%"} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#4a5568" strokeDasharray="3 3" />
            <Area type="monotone" dataKey="dd" name="Drawdown" stroke="#ef4444" strokeWidth={1.5} fill="url(#gDD)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
      <Card>
        <CardTitle>Stress Tests · Impact Estimé</CardTitle>
        <div className="grid grid-cols-3 gap-3">
          {[
            { s: "Choc marché -5%", i: "-2 712 €", p: "-5.0%" },
            { s: "Choc marché -10%", i: "-5 423 €", p: "-10.0%" },
            { s: "Choc marché -20%", i: "-10 847 €", p: "-20.0%" },
            { s: "Tech -15%", i: "-7 312 €", p: "-13.5%" },
            { s: "EUR/USD -5%", i: "-540 €", p: "-1.0%" },
            { s: "Crypto -30%", i: "-3 052 €", p: "-5.6%" },
          ].map(st => (
            <div key={st.s} className="bg-bg-2 border border-border rounded-lg p-3">
              <div className="text-[11px] text-text-2 mb-1.5">{st.s}</div>
              <div className="text-[16px] font-bold font-num text-red mb-0.5">{st.i}</div>
              <Chip value={parseFloat(st.p)} pct />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ALERTS
// ═══════════════════════════════════════════════════════════════
export function AlertsPage() {
  const { data: alerts, isLoading } = useAlerts();
  const createAlert = useCreateAlert();
  const deleteAlert = useDeleteAlert();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ symbol: "AAPL", alert_type: "PRICE_ABOVE", threshold: "" });

  const TL: Record<string, string> = {
    PRICE_ABOVE: "Prix au-dessus de", PRICE_BELOW: "Prix en-dessous de",
    CHANGE_PCT_UP: "Variation + >", CHANGE_PCT_DOWN: "Variation - >",
  };

  const handleCreate = async () => {
    if (!form.threshold) return;
    await createAlert.mutateAsync({ ...form, threshold: parseFloat(form.threshold) });
    setShow(false); setForm({ symbol: "AAPL", alert_type: "PRICE_ABOVE", threshold: "" });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <PageHeader title="Alertes" subtitle="Surveillance automatique des prix et variations" />
        <Btn variant="primary" onClick={() => setShow(!show)}><Plus size={13} /> Nouvelle alerte</Btn>
      </div>
      {show && (
        <Card>
          <CardTitle>Créer une alerte</CardTitle>
          <div className="grid grid-cols-4 gap-3 items-end">
            <Input label="Actif" value={form.symbol} onChange={v => setForm(p => ({ ...p, symbol: v.toUpperCase() }))} />
            <Select label="Condition" value={form.alert_type} onChange={v => setForm(p => ({ ...p, alert_type: v }))}
              options={Object.entries(TL).map(([k, v]) => ({ value: k, label: v }))} />
            <Input label="Valeur" type="number" value={form.threshold} onChange={v => setForm(p => ({ ...p, threshold: v }))} />
            <Btn variant="primary" onClick={handleCreate} loading={createAlert.isPending}>Créer</Btn>
          </div>
        </Card>
      )}
      {isLoading ? <Spinner /> : alerts?.length === 0 ? (
        <EmptyState icon="🔔" title="Aucune alerte active" subtitle="Créez votre première alerte de prix" />
      ) : (
        <div className="space-y-2">
          {alerts?.map((al: any) => (
            <div key={al.id} className="flex items-center gap-3 px-3 py-2.5 bg-bg-2 border border-border rounded-lg">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${al.triggered_at ? "bg-yellow" : al.is_active ? "bg-green pulse-dot" : "bg-text-3"}`} />
              <div className="flex items-center gap-2 flex-1">
                <Badge color="blue">{al.symbol}</Badge>
                <span className="text-[12px] text-text-2">{TL[al.type]}</span>
                <span className="text-[13px] font-semibold font-num">{al.threshold} {al.type?.includes("PCT") ? "%" : "€"}</span>
              </div>
              <Badge color={al.triggered_at ? "yellow" : al.is_active ? "green" : "gray"}>
                {al.triggered_at ? "⚡ Déclenchée" : al.is_active ? "● Active" : "○ Inactive"}
              </Badge>
              <Btn size="sm" variant="danger" onClick={() => deleteAlert.mutate(al.id)}><Trash2 size={11} /></Btn>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// JOURNAL
// ═══════════════════════════════════════════════════════════════
export function JournalPage() {
  const { data: entries, isLoading } = useJournal();
  const [show, setShow] = useState(false);

  const EMOTIONS = ["😌 Serein", "😊 Confiant", "😤 Impulsif", "😰 Stressé", "🤔 Incertain", "💪 Déterminé"];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <PageHeader title="Journal de Trading" subtitle="Documentez vos décisions, analysez vos biais comportementaux" />
        <Btn variant="primary" onClick={() => setShow(true)}><Plus size={13} /> Nouvelle entrée</Btn>
      </div>
      {isLoading ? <Spinner /> : entries?.length === 0 ? (
        <EmptyState icon="📓" title="Journal vide" subtitle="Commencez à documenter vos trades" />
      ) : (
        <div className="space-y-3">
          {(entries ?? []).map((e: any) => (
            <Card key={e.id} className="flex gap-3">
              <div className={`px-2 py-1 rounded text-[11px] font-bold h-fit ${e.side === "BUY" ? "bg-green-dim text-green" : "bg-red-dim text-red"}`}>
                {e.side || "NOTE"}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {e.symbol && <span className="font-bold text-[14px]">{e.symbol}</span>}
                  {e.title && <span className="font-semibold text-[13px]">{e.title}</span>}
                  <span className="text-[11px] text-text-3 font-mono">{e.created_at?.slice(0, 10)}</span>
                  {e.emotion && <span className="text-[11px] text-text-2 ml-2">{e.emotion}</span>}
                  <div className="ml-auto flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} className={i < (e.confidence || 0) ? "text-yellow" : "text-border"}>★</span>
                    ))}
                  </div>
                </div>
                {e.thesis && <p className="text-[12px] text-text-2 mb-2 leading-relaxed">{e.thesis}</p>}
                <div className="flex items-center gap-2">
                  {(e.tags || []).map((t: string) => <Badge key={t} color="blue">#{t}</Badge>)}
                  {e.outcome && (
                    <span className={`ml-auto text-[11px] font-semibold font-num ${e.outcome.startsWith("+") ? "text-green" : "text-text-2"}`}>
                      {e.outcome}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BACKTESTING
// ═══════════════════════════════════════════════════════════════
export function BacktestPage() {
  const { data: strategies } = useStrategies();
  const runBacktest = useRunBacktest();
  const [form, setForm] = useState({
    symbol: "AAPL", strategy: "sma_cross", period: "1y",
    initial_capital: 10000, fee_rate: 0.001,
    fast: 20, slow: 50, rsi_period: 14, oversold: 30, overbought: 70,
  });
  const [result, setResult] = useState<any>(null);

  const handleRun = async () => {
    const r = await runBacktest.mutateAsync(form);
    setResult(r);
  };

  return (
    <div className="space-y-3">
      <PageHeader title="Backtesting" subtitle="Testez vos stratégies sur des données historiques réelles" />
      <div className="grid grid-cols-[320px_1fr] gap-3">
        {/* Config */}
        <Card className="space-y-3">
          <CardTitle>Configuration</CardTitle>
          <Input label="Actif" value={form.symbol} onChange={v => setForm(p => ({ ...p, symbol: v.toUpperCase() }))} />
          <Select label="Stratégie" value={form.strategy} onChange={v => setForm(p => ({ ...p, strategy: v }))}
            options={(strategies || []).map((s: any) => ({ value: s.id, label: s.name }))} />
          <Select label="Période" value={form.period} onChange={v => setForm(p => ({ ...p, period: v }))}
            options={[["1mo", "1 Mois"], ["3mo", "3 Mois"], ["6mo", "6 Mois"], ["1y", "1 An"], ["2y", "2 Ans"], ["5y", "5 Ans"]].map(([v, l]) => ({ value: v, label: l }))} />
          <Input label="Capital initial (€)" type="number" value={String(form.initial_capital)} onChange={v => setForm(p => ({ ...p, initial_capital: parseFloat(v) }))} />
          {form.strategy === "sma_cross" && (
            <>
              <Input label="MA Rapide (jours)" type="number" value={String(form.fast)} onChange={v => setForm(p => ({ ...p, fast: parseInt(v) }))} />
              <Input label="MA Lente (jours)" type="number" value={String(form.slow)} onChange={v => setForm(p => ({ ...p, slow: parseInt(v) }))} />
            </>
          )}
          {form.strategy === "rsi" && (
            <>
              <Input label="Période RSI" type="number" value={String(form.rsi_period)} onChange={v => setForm(p => ({ ...p, rsi_period: parseInt(v) }))} />
              <Input label="Survente (RSI <)" type="number" value={String(form.oversold)} onChange={v => setForm(p => ({ ...p, oversold: parseFloat(v) }))} />
              <Input label="Surachat (RSI >)" type="number" value={String(form.overbought)} onChange={v => setForm(p => ({ ...p, overbought: parseFloat(v) }))} />
            </>
          )}
          <Btn variant="primary" className="w-full justify-center" onClick={handleRun} loading={runBacktest.isPending}>
            ▶ Lancer le backtest
          </Btn>
          {strategies && (
            <div className="text-[11px] text-text-3 leading-relaxed">
              {strategies.find((s: any) => s.id === form.strategy)?.description}
            </div>
          )}
        </Card>

        {/* Results */}
        <div className="space-y-3">
          {!result && !runBacktest.isPending && (
            <EmptyState icon="🧪" title="Configurez et lancez le backtest" subtitle="Les résultats apparaîtront ici" />
          )}
          {runBacktest.isPending && (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Spinner size="lg" />
              <p className="text-text-2 text-[13px]">Calcul en cours...</p>
            </div>
          )}
          {result && (
            <>
              {/* Summary metrics */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { l: "Rendement Total", v: fmtPct(result.total_return_pct), c: result.total_return_pct >= 0 ? "text-green" : "text-red" },
                  { l: "Rendement Ann.", v: fmtPct(result.annualized_return_pct), c: result.annualized_return_pct >= 0 ? "text-green" : "text-red" },
                  { l: "vs Buy & Hold", v: fmtPct(result.total_return_pct - result.benchmark_return_pct), c: (result.total_return_pct - result.benchmark_return_pct) >= 0 ? "text-green" : "text-red" },
                  { l: "Max Drawdown", v: `-${fmt2(result.max_drawdown_pct)}%`, c: "text-red" },
                  { l: "Sharpe Ratio", v: String(result.sharpe_ratio), c: "text-blue" },
                  { l: "Win Rate", v: `${result.win_rate_pct}%`, c: "text-green" },
                  { l: "Trades", v: String(result.total_trades), c: "" },
                  { l: "Capital Final", v: `${fmt2(result.final_capital)} €`, c: "text-text-1" },
                ].map(m => (
                  <Card key={m.l} className="py-2.5 px-3">
                    <div className="text-[9px] text-text-3 uppercase tracking-wider mb-1">{m.l}</div>
                    <div className={`font-bold font-num text-[14px] ${m.c}`}>{m.v}</div>
                  </Card>
                ))}
              </div>
              {/* Equity curve */}
              <Card>
                <CardTitle>Courbe de Capital</CardTitle>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={result.equity_curve}>
                    <defs>
                      <linearGradient id="gEq" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2336" />
                    <XAxis dataKey="date" tick={{ fill: "#4a5568", fontSize: 9 }} tickLine={false} />
                    <YAxis tick={{ fill: "#4a5568", fontSize: 9 }} tickFormatter={v => fmtCompact(v)} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={result.initial_capital} stroke="#4a5568" strokeDasharray="3 3" label={{ value: "Capital init.", fill: "#4a5568", fontSize: 9 }} />
                    <Area type="monotone" dataKey="value" name="Capital" stroke="#3b82f6" strokeWidth={2} fill="url(#gEq)" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
              {/* Trades */}
              {result.trades?.length > 0 && (
                <Card className="p-0">
                  <div className="px-3.5 py-3 border-b border-border">
                    <CardTitle className="mb-0">Trades ({result.total_trades} total · {result.winning_trades} gagnants · {result.losing_trades} perdants)</CardTitle>
                  </div>
                  <Table headers={["Entrée", "Sortie", "Côté", "Qté", "Px Entrée", "Px Sortie", "P&L", "P&L%", "Durée"]}>
                    {result.trades.slice(0, 20).map((t: any, i: number) => (
                      <TR key={i}>
                        <TD className="font-mono text-[11px] text-text-3">{t.entry_date}</TD>
                        <TD className="font-mono text-[11px] text-text-3">{t.exit_date}</TD>
                        <TD><Badge color={t.side === "LONG" ? "green" : "red"}>{t.side}</Badge></TD>
                        <TD className="font-num text-[11px]">{t.qty?.toFixed(4)}</TD>
                        <TD className="font-num text-[11px]">{fmt2(t.entry_price)}</TD>
                        <TD className="font-num text-[11px]">{fmt2(t.exit_price)}</TD>
                        <TD className={`font-num text-[11px] ${t.pnl >= 0 ? "text-green" : "text-red"}`}>
                          {t.pnl >= 0 ? "+" : ""}{fmt2(t.pnl)} €
                        </TD>
                        <TD><Chip value={t.pnl_pct} pct /></TD>
                        <TD className="text-[11px] text-text-2">{t.duration_days}j</TD>
                      </TR>
                    ))}
                  </Table>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
