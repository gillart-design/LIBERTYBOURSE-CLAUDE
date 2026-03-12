// src/lib/store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

// ── Auth Store ─────────────────────────────────────────────────
interface User {
  id: number;
  email: string;
  username: string;
  full_name?: string;
  currency: string;
  theme: string;
  is_demo: boolean;
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      setAuth: (token, user) => {
        localStorage.setItem("tf_token", token);
        set({ token, user });
      },
      logout: () => {
        localStorage.removeItem("tf_token");
        set({ token: null, user: null });
      },
      isAuthenticated: () => !!get().token,
    }),
    { name: "tf-auth", partialize: (s) => ({ token: s.token, user: s.user }) }
  )
);

// ── Live Prices Store ──────────────────────────────────────────
interface PriceData {
  symbol: string;
  price: number;
  change: number;
  change_pct: number;
  volume: number;
  bid: number;
  ask: number;
  open: number;
  high: number;
  low: number;
  prev_close: number;
  timestamp: string;
  source: string;
  is_delayed: boolean;
}

interface PriceStore {
  prices: Record<string, PriceData>;
  connected: boolean;
  wsRef: WebSocket | null;
  updatePrice: (data: PriceData) => void;
  updatePrices: (data: PriceData[]) => void;
  setConnected: (v: boolean) => void;
  connect: (symbols?: string[]) => void;
  disconnect: () => void;
  subscribe: (symbols: string[]) => void;
}

export const usePriceStore = create<PriceStore>((set, get) => ({
  prices: {},
  connected: false,
  wsRef: null,

  updatePrice: (data) =>
    set((s) => ({ prices: { ...s.prices, [data.symbol]: data } })),

  updatePrices: (data) =>
    set((s) => {
      const next = { ...s.prices };
      data.forEach((d) => { next[d.symbol] = d; });
      return { prices: next };
    }),

  setConnected: (v) => set({ connected: v }),

  connect: (symbols = []) => {
    const { wsRef, disconnect } = get();
    if (wsRef) disconnect();

    const wsUrl = (process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000") + "/api/v1/market/ws/prices";
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      set({ connected: true });
      if (symbols.length > 0) {
        ws.send(JSON.stringify({ action: "subscribe", symbols }));
      }
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === "price_update") {
          const data = msg.data;
          if (Array.isArray(data)) {
            get().updatePrices(data);
          } else if (data?.symbol) {
            get().updatePrice(data);
          }
        }
      } catch {}
    };

    ws.onclose = () => set({ connected: false, wsRef: null });
    ws.onerror = () => set({ connected: false });

    set({ wsRef: ws });
  },

  disconnect: () => {
    const { wsRef } = get();
    if (wsRef) {
      wsRef.close();
      set({ wsRef: null, connected: false });
    }
  },

  subscribe: (symbols) => {
    const { wsRef, connected } = get();
    if (wsRef && connected) {
      wsRef.send(JSON.stringify({ action: "subscribe", symbols }));
    }
  },
}));

// ── UI Store ───────────────────────────────────────────────────
interface UIState {
  sidebarOpen: boolean;
  activePage: string;
  selectedPortfolioId: number | null;
  setSidebarOpen: (v: boolean) => void;
  setActivePage: (p: string) => void;
  setSelectedPortfolioId: (id: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  activePage: "dashboard",
  selectedPortfolioId: null,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setActivePage: (p) => set({ activePage: p }),
  setSelectedPortfolioId: (id) => set({ selectedPortfolioId: id }),
}));
