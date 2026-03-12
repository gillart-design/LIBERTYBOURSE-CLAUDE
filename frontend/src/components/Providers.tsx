"use client";
// src/components/Providers.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { usePriceStore, useAuthStore } from "@/lib/store";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const DEFAULT_SYMBOLS = [
  "AAPL", "MSFT", "NVDA", "TSLA", "GOOGL", "AMZN", "META",
  "MC.PA", "TTE.PA", "AIR.PA", "SPY", "QQQ", "BTC-USD", "ETH-USD",
];

function WSInit() {
  const connect = usePriceStore(s => s.connect);
  const disconnect = usePriceStore(s => s.disconnect);
  const token = useAuthStore(s => s.token);
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    connect(DEFAULT_SYMBOLS);
    return () => disconnect();
  }, []);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WSInit />
      {children}
    </QueryClientProvider>
  );
}
