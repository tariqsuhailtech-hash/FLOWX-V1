// FLOWX market data client.
// Connects to the FLOWX backend WebSocket (/api/ws/market) which runs the real
// exchange pipeline (Binance / Bybit official public feeds -> normalization ->
// order book -> footprint -> analytics). This module holds NO fake/simulated
// data: every value here originates from a real backend stream. When no real
// data is available the backend reports the appropriate status (connecting /
// reconnecting / stale / disconnected) and this client surfaces it unchanged.

export const EXCHANGES = ["BINANCE", "BYBIT", "GATE.IO"];
export const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"];
export const TIMEFRAMES = ["1m", "3m", "5m", "15m", "30m", "1h"];
export const DEPTHS = [10, 25, 50, 100, 200, 1000];
// Footprint price-level aggregation tick + price decimals (display config only).
export const TICK = { BTCUSDT: 10, ETHUSDT: 1, SOLUSDT: 0.1, BNBUSDT: 0.5, XRPUSDT: 0.001 };
export const PRICE_DEC = { BTCUSDT: 1, ETHUSDT: 2, SOLUSDT: 3, BNBUSDT: 2, XRPUSDT: 4 };
export const TF_MS = { "1m": 6e4, "3m": 18e4, "5m": 3e5, "15m": 9e5, "30m": 18e5, "1h": 36e5 };

export const decimalsOf = (tick) => (tick >= 1 ? 0 : Math.ceil(-Math.log10(tick)));
export function levelNum(price, tick) {
  const q = price / tick;
  const r = Math.round(q);
  const base = Math.abs(q - r) < 1e-6 ? r : Math.floor(q);
  return +(base * tick).toFixed(decimalsOf(tick));
}
export const levelKey = (price, tick) => levelNum(price, tick).toFixed(decimalsOf(tick));

const WS_URL = `${(process.env.REACT_APP_BACKEND_URL || "").replace(/^http/, "ws")}/api/ws/market`;
const MAX_CANDLES = 400;
const MAX_TRADES = 150;

export class MarketEngine {
  constructor(cfg = {}) {
    this.cfg = { exchange: "BINANCE", symbol: "BTCUSDT", tf: "1m", marketType: "spot", depth: 20, ...cfg };
    this.listeners = new Set();
    this.session = 0;
    this.ws = null;
    this.reset();
  }

  reset() {
    const sym = this.cfg.symbol;
    this.tick = TICK[sym] || 1;
    this.state = {
      ...this.cfg, version: 0, status: "connecting", source: "connecting…", latency: 0, msgRate: 0, tick: this.tick,
      ticker: { last: 0, prev: 0, dir: 0, changePct: 0, change: 0, volume: 0, quoteVolume: 0, high: 0, low: 0 },
      book: { bids: [], asks: [] }, trades: [], candles: [], pdh: 0, pdl: 0, lastBookUpdate: 0,
    };
    this.snap = { ...this.state };
  }

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  snapshot() { return this.snap; }

  emit() {
    this.state.version = (this.state.version || 0) + 1;
    this.snap = { ...this.state };
    this.listeners.forEach((fn) => fn(this.snap));
  }

  start() {
    this.stop();
    this.reset();
    this.emit();
    this._connect();
  }

  stop() {
    this.session++;
    clearTimeout(this._retry);
    if (this.ws) {
      this.ws.onopen = this.ws.onclose = this.ws.onmessage = this.ws.onerror = null;
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
  }

  configure(patch) {
    Object.assign(this.cfg, patch);
    this.start();
  }

  setDepth(n) {
    this.cfg.depth = n;
    this.state.depth = n;
    this.emit();
    if (this.ws && this.ws.readyState === 1) this._send({ action: "depth", depth: n });
  }

  _subMsg() {
    return { action: "subscribe", exchange: this.cfg.exchange, symbol: this.cfg.symbol, marketType: this.cfg.marketType, tf: this.cfg.tf, depth: this.cfg.depth };
  }
  _send(obj) { try { this.ws.send(JSON.stringify(obj)); } catch {} }

  _connect() {
    const token = this.session;
    let ws;
    try { ws = new WebSocket(WS_URL); } catch { this._scheduleRetry(token); return; }
    this.ws = ws;
    ws.onopen = () => { if (token !== this.session) return; this._send(this._subMsg()); };
    ws.onmessage = (ev) => { if (token !== this.session) return; let m; try { m = JSON.parse(ev.data); } catch { return; } this._onMsg(m); };
    ws.onclose = () => {
      if (token !== this.session) return;
      this.state.status = "reconnecting"; this.state.source = "reconnecting…"; this.emit();
      this._scheduleRetry(token);
    };
    ws.onerror = () => {};
  }

  _scheduleRetry(token) {
    clearTimeout(this._retry);
    this._retry = setTimeout(() => { if (token === this.session) this._connect(); }, 1500);
  }

  _onMsg(m) {
    if (m.type === "snapshot") {
      const s = m.state;
      this.tick = s.tick || this.tick;
      this.state = { ...this.state, ...s };
      this.emit();
      return;
    }
    if (m.type === "patch") {
      const S = this.state;
      if (m.status !== undefined) S.status = m.status;
      if (m.source !== undefined) S.source = m.source;
      if (m.latency !== undefined) S.latency = m.latency;
      if (m.msgRate !== undefined) S.msgRate = m.msgRate;
      if (m.tick !== undefined) { S.tick = m.tick; this.tick = m.tick; }
      if (m.ticker) S.ticker = { ...S.ticker, ...m.ticker };
      if (m.pdh !== undefined) S.pdh = m.pdh;
      if (m.pdl !== undefined) S.pdl = m.pdl;
      if (m.book) { S.book = m.book; S.lastBookUpdate = m.lastBookUpdate; }
      if (m.candles && m.candles.length) {
        const idx = new Map(S.candles.map((c, i) => [c.t, i]));
        let appended = false;
        m.candles.forEach((nc) => {
          const i = idx.get(nc.t);
          if (i != null) S.candles[i] = nc;
          else { S.candles.push(nc); appended = true; }
        });
        if (appended) S.candles.sort((a, b) => a.t - b.t);
        if (S.candles.length > MAX_CANDLES) S.candles = S.candles.slice(-MAX_CANDLES);
      }
      if (m.trades && m.trades.length) S.trades = [...m.trades, ...S.trades].slice(0, MAX_TRADES);
      this.emit();
    }
  }
}
