// src/lib/api.ts
import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("tf_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("tf_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// ── Market ─────────────────────────────────────────────────────
export const marketApi = {
  quote: (symbol: string) => api.get(`/api/v1/market/quote/${symbol}`).then(r => r.data),
  quotes: (symbols: string[]) => api.get(`/api/v1/market/quotes?symbols=${symbols.join(",")}`).then(r => r.data),
  history: (symbol: string, period = "1y") => api.get(`/api/v1/market/history/${symbol}?period=${period}`).then(r => r.data),
  search: (q: string) => api.get(`/api/v1/market/search?q=${encodeURIComponent(q)}`).then(r => r.data),
  provider: () => api.get("/api/v1/market/provider").then(r => r.data),
};

// ── Portfolio ──────────────────────────────────────────────────
export const portfolioApi = {
  list: () => api.get("/api/v1/portfolios/").then(r => r.data),
  get: (id: number) => api.get(`/api/v1/portfolios/${id}`).then(r => r.data),
  create: (data: any) => api.post("/api/v1/portfolios/", data).then(r => r.data),
};

// ── Orders ─────────────────────────────────────────────────────
export const ordersApi = {
  place: (data: any) => api.post("/api/v1/orders/", data).then(r => r.data),
  history: (portfolioId: number) => api.get(`/api/v1/orders/${portfolioId}/history`).then(r => r.data),
};

// ── Watchlists ─────────────────────────────────────────────────
export const watchlistApi = {
  list: () => api.get("/api/v1/watchlists/").then(r => r.data),
  addSymbol: (id: number, symbol: string) => api.post(`/api/v1/watchlists/${id}/symbols?symbol=${symbol}`).then(r => r.data),
  removeSymbol: (id: number, symbol: string) => api.delete(`/api/v1/watchlists/${id}/symbols/${symbol}`).then(r => r.data),
};

// ── Alerts ─────────────────────────────────────────────────────
export const alertsApi = {
  list: () => api.get("/api/v1/alerts/").then(r => r.data),
  create: (data: any) => api.post("/api/v1/alerts/", data).then(r => r.data),
  delete: (id: number) => api.delete(`/api/v1/alerts/${id}`).then(r => r.data),
};

// ── Journal ────────────────────────────────────────────────────
export const journalApi = {
  list: () => api.get("/api/v1/journal/").then(r => r.data),
  create: (data: any) => api.post("/api/v1/journal/", data).then(r => r.data),
};

// ── Auth ───────────────────────────────────────────────────────
export const authApi = {
  register: (data: any) => api.post("/api/v1/auth/register", data).then(r => r.data),
  login: (username: string, password: string) => {
    const form = new FormData();
    form.append("username", username);
    form.append("password", password);
    return api.post("/api/v1/auth/token", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    }).then(r => r.data);
  },
};

// ── Backtesting ────────────────────────────────────────────────
export const backtestApi = {
  strategies: () => api.get("/api/v1/backtest/strategies").then(r => r.data),
  run: (data: any) => api.post("/api/v1/backtest/run", data).then(r => r.data),
};
