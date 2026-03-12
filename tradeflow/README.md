# TradeFlow — Simulateur Boursier Professionnel

Stack complète : **FastAPI + PostgreSQL + Redis + WebSocket + Next.js 14 + TypeScript**

---

## Architecture

```
tradeflow/
├── backend/                     # FastAPI Python
│   ├── app/
│   │   ├── main.py              # Entry point, routers, lifespan
│   │   ├── core/
│   │   │   ├── config.py        # Settings (pydantic-settings)
│   │   │   ├── database.py      # SQLAlchemy async engine
│   │   │   ├── redis.py         # Redis client + cache helpers
│   │   │   └── security.py      # JWT + bcrypt
│   │   ├── models/              # SQLAlchemy ORM models
│   │   ├── api/v1/              # All route handlers
│   │   └── services/
│   │       ├── market_data/
│   │       │   ├── provider.py  # Yahoo/TwelveData/Polygon + Demo
│   │       │   └── scheduler.py # Background price polling → Redis pubsub
│   │       └── backtesting/
│   │           └── engine.py    # SMA/RSI/BB/B&H strategies
│   └── requirements.txt
├── frontend/                    # Next.js 14 TypeScript
│   └── src/
│       ├── app/                 # App Router pages
│       ├── components/
│       │   ├── layout/          # Sidebar, Topbar, TickerTape
│       │   ├── pages/           # Dashboard, Market, Portfolio, etc.
│       │   └── ui/              # Design system components
│       └── lib/
│           ├── api.ts           # Axios client + all API calls
│           ├── store.ts         # Zustand (auth + live prices + UI)
│           ├── hooks.ts         # React Query hooks
│           └── utils.ts         # Formatters + constants
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Démarrage rapide (local)

### Prérequis
- Docker Desktop (Mac/Windows) ou Docker Engine (Linux)
- Git

### Installation

```bash
# 1. Cloner le repo
git clone https://github.com/VOTRE_USERNAME/tradeflow.git
cd tradeflow

# 2. Configurer les variables d'environnement
cp .env.example .env
# Éditer .env si vous avez des clés API (optionnel — demo mode par défaut)

# 3. Lancer tout le stack
docker compose up --build

# 4. Ouvrir l'application
open http://localhost:3000
# API docs: http://localhost:8000/docs
```

C'est tout. En mode DEMO, aucune clé API n'est nécessaire.

---

## Configuration des données de marché

### Mode DEMO (défaut)
Aucune configuration. Données simulées réalistes avec volatilité cohérente.

### Yahoo Finance (gratuit, délai 15min)
```env
DEMO_MODE=false
YAHOO_FALLBACK=true
# Pas de clé API nécessaire
```

### Twelve Data (quasi-temps réel, 800 appels/jour gratuits)
```bash
# Créez un compte sur https://twelvedata.com
# Free tier: 800 appels/jour, données quasi-live
```
```env
DEMO_MODE=false
TWELVE_DATA_API_KEY=votre_cle_ici
```

### Polygon.io (temps réel, WebSocket ticks)
```bash
# https://polygon.io — Free tier: 5 appels/min
# Starter $29/mois: données retardées + REST
# Developer $79/mois: WebSocket temps réel
```
```env
DEMO_MODE=false
POLYGON_API_KEY=votre_cle_ici
```

**Priorité automatique :** Polygon > Twelve Data > Yahoo > Demo

---

## Déploiement sur Railway ⭐ (recommandé)

Railway est la solution la plus simple pour ce stack.
**Coût estimé : ~$10-20/mois** (PostgreSQL + Redis + 2 services)

### Étapes

1. **Créer un compte** sur https://railway.app

2. **Créer un nouveau projet** → "Deploy from GitHub repo"

3. **Connecter votre repo GitHub** (TradeFlow doit être pushé)

4. **Ajouter les services** dans Railway :
   - PostgreSQL (depuis le catalogue Railway)
   - Redis (depuis le catalogue Railway)
   - Backend service (pointe vers `/backend`)
   - Frontend service (pointe vers `/frontend`)

5. **Variables d'environnement** à configurer dans Railway :
   ```
   # Backend service
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   REDIS_URL=${{Redis.REDIS_URL}}
   SECRET_KEY=<générer avec: python -c "import secrets; print(secrets.token_hex(32))">
   DEMO_MODE=false
   POLYGON_API_KEY=<optionnel>
   TWELVE_DATA_API_KEY=<optionnel>
   CORS_ORIGINS=https://votre-frontend.up.railway.app

   # Frontend service
   NEXT_PUBLIC_API_URL=https://votre-backend.up.railway.app
   NEXT_PUBLIC_WS_URL=wss://votre-backend.up.railway.app
   ```

6. **Déployer** — Railway build et deploy automatiquement à chaque push.

### Alternative : Render

Très similaire à Railway. PostgreSQL + Redis inclus.
Documentation : https://render.com/docs

---

## Pousser sur GitHub

```bash
# Depuis la racine du projet
git init
git add .
git commit -m "feat: TradeFlow v1.0 — full stack trading simulator"

# Créer un repo sur github.com puis :
git remote add origin https://github.com/VOTRE_USERNAME/tradeflow.git
git branch -M main
git push -u origin main
```

---

## API Reference

Base URL : `http://localhost:8000`

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/v1/auth/register` | POST | Créer un compte |
| `/api/v1/auth/token` | POST | Connexion (JWT) |
| `/api/v1/market/quote/{symbol}` | GET | Prix en temps réel |
| `/api/v1/market/quotes?symbols=` | GET | Multi-cotations |
| `/api/v1/market/history/{symbol}` | GET | Historique OHLCV |
| `/api/v1/market/ws/prices` | WebSocket | Flux prix live |
| `/api/v1/portfolios/` | GET/POST | Portefeuilles |
| `/api/v1/orders/` | POST | Passer un ordre |
| `/api/v1/orders/{id}/history` | GET | Historique ordres |
| `/api/v1/alerts/` | GET/POST | Alertes prix |
| `/api/v1/journal/` | GET/POST | Journal trades |
| `/api/v1/backtest/strategies` | GET | Stratégies dispo |
| `/api/v1/backtest/run` | POST | Lancer backtest |
| `/health` | GET | Health check |

Documentation interactive : `http://localhost:8000/docs`

---

## Fonctionnalités

### Données de marché
- Provider abstrait avec fallback automatique
- Cache Redis (TTL configurable)
- WebSocket Redis pub/sub → frontend temps réel
- Polling background scheduler (configurable)
- Support : actions US/FR, ETF, crypto, indices

### Portfolio
- Positions avec coût moyen pondéré
- P&L latent et réalisé
- Cash management
- Simulation de frais (0.1% + fixe) + slippage

### Ordres
- Marché, Limite, Stop
- Validation côté serveur (cash/positions)
- Historique complet

### Backtesting
- SMA Crossover, RSI, Bollinger Bands, Buy & Hold
- Métriques : Sharpe, Sortino, Calmar, Win Rate, Profit Factor
- Courbe d'équité, drawdown, liste de trades
- Benchmark vs Buy & Hold automatique

### Alertes
- Prix au-dessus/en-dessous d'un seuil
- Variation en % (hausse/baisse)

---

## Variables d'environnement complètes

Voir [`.env.example`](.env.example) pour la liste complète commentée.

---

## Stack technique

| Composant | Technologie | Version |
|-----------|------------|---------|
| Backend | FastAPI | 0.115 |
| ORM | SQLAlchemy (async) | 2.0 |
| DB | PostgreSQL | 16 |
| Cache | Redis | 7 |
| Auth | JWT (python-jose) | — |
| Frontend | Next.js | 14 |
| State | Zustand | 5 |
| Queries | React Query | 5 |
| Charts | Recharts | 2.14 |
| Styles | Tailwind CSS | 3.4 |
| WebSocket | native + Redis pubsub | — |
| Deploy | Docker Compose / Railway | — |
