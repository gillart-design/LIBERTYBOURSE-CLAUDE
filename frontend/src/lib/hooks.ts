// src/lib/hooks.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { marketApi, portfolioApi, ordersApi, watchlistApi, alertsApi, journalApi, backtestApi } from "./api";
import { usePriceStore } from "./store";

// ── Market ──────────────────────────────────────────────────────
export const useQuote = (symbol: string) =>
  useQuery({
    queryKey: ["quote", symbol],
    queryFn: () => marketApi.quote(symbol),
    refetchInterval: 15_000,
    enabled: !!symbol,
  });

export const useQuotes = (symbols: string[]) =>
  useQuery({
    queryKey: ["quotes", symbols.sort().join(",")],
    queryFn: () => marketApi.quotes(symbols),
    refetchInterval: 15_000,
    enabled: symbols.length > 0,
  });

export const useHistory = (symbol: string, period = "1y") =>
  useQuery({
    queryKey: ["history", symbol, period],
    queryFn: () => marketApi.history(symbol, period),
    staleTime: 5 * 60 * 1000,
    enabled: !!symbol,
  });

export const useSearch = (query: string) =>
  useQuery({
    queryKey: ["search", query],
    queryFn: () => marketApi.search(query),
    enabled: query.length >= 1,
    staleTime: 30_000,
  });

export const useProviderInfo = () =>
  useQuery({ queryKey: ["provider"], queryFn: marketApi.provider, staleTime: 60_000 });

// ── Portfolios ──────────────────────────────────────────────────
export const usePortfolios = () =>
  useQuery({
    queryKey: ["portfolios"],
    queryFn: portfolioApi.list,
    refetchInterval: 30_000,
  });

export const usePortfolio = (id: number | null) =>
  useQuery({
    queryKey: ["portfolio", id],
    queryFn: () => portfolioApi.get(id!),
    enabled: !!id,
    refetchInterval: 30_000,
  });

// ── Orders ──────────────────────────────────────────────────────
export const useOrderHistory = (portfolioId: number | null) =>
  useQuery({
    queryKey: ["orders", portfolioId],
    queryFn: () => ordersApi.history(portfolioId!),
    enabled: !!portfolioId,
  });

export const usePlaceOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ordersApi.place,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolios"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
};

// ── Watchlists ───────────────────────────────────────────────────
export const useWatchlists = () =>
  useQuery({ queryKey: ["watchlists"], queryFn: watchlistApi.list, refetchInterval: 30_000 });

// ── Alerts ────────────────────────────────────────────────────
export const useAlerts = () =>
  useQuery({ queryKey: ["alerts"], queryFn: alertsApi.list });

export const useCreateAlert = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: alertsApi.create, onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }) });
};

export const useDeleteAlert = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: alertsApi.delete, onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }) });
};

// ── Journal ────────────────────────────────────────────────────
export const useJournal = () =>
  useQuery({ queryKey: ["journal"], queryFn: journalApi.list });

// ── Backtest ───────────────────────────────────────────────────
export const useStrategies = () =>
  useQuery({ queryKey: ["strategies"], queryFn: backtestApi.strategies });

export const useRunBacktest = () =>
  useMutation({ mutationFn: backtestApi.run });

// ── Live price from store (updated via WebSocket) ──────────────
export const useLivePrice = (symbol: string) => {
  const prices = usePriceStore(s => s.prices);
  return prices[symbol] ?? null;
};
