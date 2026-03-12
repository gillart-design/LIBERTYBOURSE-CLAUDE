"use client";
// src/app/page.tsx
import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { TickerTape } from "@/components/layout/TickerTape";
import { Dashboard } from "@/components/pages/Dashboard";
import { MarketPage } from "@/components/pages/MarketPage";
import { PortfolioPage } from "@/components/pages/PortfolioPage";
import { AssetDetailPage } from "@/components/pages/AssetDetailPage";
import { AnalyticsPage } from "@/components/pages/AnalyticsPage";
import { AlertsPage } from "@/components/pages/AlertsPage";
import { JournalPage } from "@/components/pages/JournalPage";
import { BacktestPage } from "@/components/pages/BacktestPage";
import { useUIStore } from "@/lib/store";

export type Page =
  | "dashboard" | "market" | "portfolio"
  | "analytics" | "alerts" | "journal" | "backtest"
  | "asset";

export default function Home() {
  const { activePage, setActivePage } = useUIStore();
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  const navigate = (page: Page, symbol?: string) => {
    if (symbol) setSelectedSymbol(symbol);
    setActivePage(page);
  };

  const renderPage = () => {
    switch (activePage) {
      case "dashboard":  return <Dashboard onNavigate={navigate} />;
      case "market":     return <MarketPage onNavigate={navigate} />;
      case "portfolio":  return <PortfolioPage onNavigate={navigate} />;
      case "analytics":  return <AnalyticsPage />;
      case "alerts":     return <AlertsPage />;
      case "journal":    return <JournalPage />;
      case "backtest":   return <BacktestPage />;
      case "asset":      return <AssetDetailPage symbol={selectedSymbol!} onBack={() => setActivePage("market")} />;
      default:           return <Dashboard onNavigate={navigate} />;
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TickerTape />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activePage={activePage as Page} onNavigate={navigate} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Topbar onNavigate={navigate} />
          <main className="flex-1 overflow-y-auto p-4 bg-bg fade-in">
            {renderPage()}
          </main>
        </div>
      </div>
    </div>
  );
}
