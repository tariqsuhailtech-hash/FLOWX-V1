# FLOWX — Professional Crypto Order-Flow Analytics (REAL-DATA-ONLY)

## Original problem statement
Transform the uploaded FLOWX UI/UX design into a fully functional, real-time professional
Crypto Order-Flow Analytics SaaS. ABSOLUTE RULES: zero fake/random/simulated/sample market
data anywhere; every market value must originate from real Binance/Bybit/Gate.io public
APIs/WebSockets; when real data is unavailable show CONNECTING/STALE/DISCONNECTED/UNAVAILABLE,
never fabricated values. Preserve the existing FLOWX design; connect it to a real backend
pipeline (exchange adapters -> normalization -> order book -> trade/footprint engine ->
analytics -> signals -> FastAPI -> frontend WebSocket -> terminal).

## User choices (locked)
- Scope: Phase-1 everything (priority: real Binance+Bybit core first, then analytics/alerts, then paper/journal, then recording/replay/backtest). No feature faked to appear complete.
- Auth: JWT email/password, roles USER/ADMIN. Seeded: admin@flowx.com/password (admin), masteruser@flowx.com/password (user) — idempotent, not shown in public UI, changeable via backend/.env.
- Markets: spot + perpetual selectable where the exchange actually supports it. Default BTCUSDT.
- Exchanges Phase-1: Binance + Bybit live; Gate.io = "Coming Later" (never fake).
- Admin dashboard: yes, ADMIN-protected.

## Architecture (as built)
- Frontend: React 19 + Tailwind + shadcn (UPLOADED FLOWX design preserved). Data layer rewritten:
  `lib/marketEngine.js` is now a thin WebSocket client to the backend (no Math.random, no sim,
  no synthCandle). `lib/analytics.js` computes deterministic overlays/signals from REAL candle
  cells. `hooks/useMarket.js` unchanged interface.
- Backend: FastAPI + Motor (MongoDB). Modules:
  - `exchanges/base.py` BaseExchangeProvider; `exchanges/binance.py` BinanceProvider (SPOT: real
    aggTrade/depth20/ticker WS + klines & aggTrades REST seed; perp disabled = geo-restricted);
    `exchanges/bybit.py` BybitProvider (spot+linear WS: publicTrade + orderbook.50/200 snapshot/
    delta + tickers; no REST = CloudFront geo-block, candles build live) + GateProvider ("Coming Later").
  - `hub.py` Session (builds candles+footprint cells from real trades, normalized order book,
    ticker, latency/msg-rate/staleness, recording of closed candles, broadcast snapshot+patches)
    and MarketHub (ref-counted shared sessions, admin feed_stats).
  - `market_ws.py` WS endpoint `/api/ws/market`. `fputil.py` footprint tick/level/candle utils.
  - `auth.py` (JWT/bcrypt, current_user/admin_user, idempotent seed). `db.py` (mongo, serializers,
    indexes incl candles TTL retention). `routes_user.py`, `routes_admin.py`, `routes_public.py`.
- Data flow verified end-to-end: real exchange -> WS -> backend normalization -> order book/
  trade/footprint engine -> analytics -> `/api/ws/market` -> terminal.

## Real-environment capability matrix (verified from server)
- BINANCE spot: LIVE (REST+WS). BINANCE perp: DISCONNECTED (fapi/fstream 451 geo-block) — honest.
- BYBIT spot + linear(perp): LIVE (WS). Bybit REST blocked -> no historical seed (live build).
- GATE.IO: "Coming Later" (not configured) — never fake.

## Credentials
See `/app/memory/test_credentials.md`.

## Implemented (2026-10)
- Real-time: price, trades (tape), synchronized order book/DOM, footprint (bid×ask/delta/volume),
  per-candle + cumulative delta (CVD), POC, volume profile (VAH/VAL/HVN/LVN), VWAP±σ, liquidity,
  imbalance + stacked imbalance, potential-absorption proxy, large trades, rules-based signals.
- Status surfacing: LIVE/CONNECTING/RECONNECTING/STALE/DISCONNECTED/ERROR (StatusDot).
- Auth (register/login/logout/me, roles, seeded admin+user), protected routes.
- User data: settings, profile, favorites, usage/limits, price alerts CRUD, signal logging,
  layouts CRUD, journal CRUD (real pnl). Dashboard, Settings pages.
- Admin: real overview (users/active/online/subs/MRR/connections/ws-health/feeds/latency),
  user management (plan/status/role), system settings.
- Recording: closed candles upserted to Mongo with TTL retention; `/api/market/recorded` for
  replay. Replay/backtest operate on real candles (frontend ReplayBar + BacktestTab).
- Landing (real-feed hero preview, pricing from API, FAQ/disclaimers rewritten for real data),
  mobile terminal.

## Testing
- iteration_2: backend 37/37 pass; frontend all core flows pass. Fixed: removed stale
  "SIMULATED DATA" label on landing preview (now real feed + live status badge).

## Known limitations (honest)
- Binance USDⓈ-M perpetual unavailable from server region (geo-block) -> shown DISCONNECTED.
- Bybit REST geo-blocked -> no historical candle seed for Bybit (candles build live from first trade).
- Gate.io not yet integrated -> "Coming Later".
- Historical footprint cells exist only for bars covered by real aggTrades backfill / live stream;
  older bars show OHLC outline with real aggregate delta but empty cells (never fabricated).
- Public L2 is not institutional MBO; absorption is an observable-data proxy; signals are
  analytical, deterministic and NOT guaranteed profitable.

## Backlog (P1/P2)
- P1: Bybit historical seed via an allowed data source; paper-trading UI (backend-ready pattern);
  order-book snapshot recording + full heatmap history; backend-authoritative signal/analytics stream.
- P2: Stripe subscriptions; plan-gated feature enforcement; keyboard shortcuts; CSV export;
  password reset UI; Gate.io adapter when reachable.
