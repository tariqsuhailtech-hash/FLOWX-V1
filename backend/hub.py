import asyncio
from collections import deque

from fputil import TF_MS, tick_for, new_candle, add_trade
from exchanges.binance import BinanceProvider
from exchanges.bybit import BybitProvider, GateProvider
from db import db, now_ms, now_iso

PROVIDERS = {"BINANCE": BinanceProvider, "BYBIT": BybitProvider, "GATE.IO": GateProvider}
MAX_CANDLES = 400
TRADE_BUF = 200
STALE_MS = 6000
IDLE_STOP_S = 20


class Session:
    def __init__(self, hub, key, exchange, symbol, market_type, tf):
        self.hub = hub
        self.key = key
        self.exchange = exchange
        self.symbol = symbol
        self.market_type = market_type
        self.tf = tf
        self.tf_ms = TF_MS.get(tf, 60000)
        self.tick = tick_for(symbol)
        self.status = "connecting"
        self.source = "connecting…"
        self.latency = 0
        self.candles = []
        self.index = {}
        self.book = {"bids": [], "asks": []}
        self.trades = deque(maxlen=TRADE_BUF)
        self.ticker = {"last": 0.0, "prev": 0.0, "dir": 0, "changePct": 0.0,
                       "change": 0.0, "volume": 0.0, "quoteVolume": 0.0,
                       "high": 0.0, "low": 0.0}
        self.pdh = 0.0
        self.pdl = 0.0
        self._tid = 0
        self.msg_count = 0
        self.msg_rate = 0
        self.total_msgs = 0
        self.last_trade_ts = 0
        self.last_book_ts = 0
        self.last_msg_ts = 0
        self.connected_at = None
        self.reconnects = 0
        self.clients = {}       # ws -> depth
        self.pending_trades = []
        self.changed = set()
        self.book_dirty = False
        self.stopped = False
        self._empty_since = None
        self.tasks = []
        self.provider = PROVIDERS.get(exchange, GateProvider)()

    @property
    def depth(self):
        return max(self.clients.values()) if self.clients else 20

    # ---- provider callbacks ----
    def set_status(self, status, source=None):
        self.status = status
        if source is not None:
            self.source = source

    def set_candles(self, candles):
        self.candles = candles[-MAX_CANDLES:]
        self.index = {c["t"]: c for c in self.candles}

    def seed_ticker(self, patch):
        self.ticker.update(patch)
        if self.ticker["last"]:
            self.ticker["prev"] = self.ticker["last"]

    def mark_connected(self):
        if self.connected_at is None:
            self.connected_at = now_ms()

    def note_reconnect(self):
        self.reconnects += 1
        self.connected_at = None

    def inc_msg(self, n=1):
        self.msg_count += n
        self.total_msgs += n
        self.last_msg_ts = now_ms()

    def on_trade(self, price, qty, side, ts, exch_ts):
        tfms = self.tf_ms
        t = (int(ts) // tfms) * tfms
        c = self.index.get(t)
        if c is None:
            if self.candles and t < self.candles[-1]["t"]:
                return
            prev = self.candles[-1] if self.candles else None
            c = new_candle(t, price)
            self.candles.append(c)
            self.index[t] = c
            if prev is not None:
                self._record(prev)
            if len(self.candles) > MAX_CANDLES:
                old = self.candles.pop(0)
                self.index.pop(old["t"], None)
        add_trade(c, price, qty, side, self.tick)
        tk = self.ticker
        tk["prev"] = tk["last"]
        tk["last"] = price
        tk["dir"] = 1 if price > tk["prev"] else -1 if price < tk["prev"] else tk["dir"]
        if exch_ts:
            self.latency = max(0, now_ms() - int(exch_ts))
        self._tid += 1
        tr = {"id": self._tid, "time": int(ts), "price": price, "qty": qty,
              "side": side, "value": price * qty}
        self.trades.appendleft(tr)
        self.pending_trades.append(tr)
        self.changed.add(t)
        self.last_trade_ts = now_ms()
        self.inc_msg()

    def on_book(self, bids, asks, ts):
        self.book = {"bids": bids, "asks": asks}
        self.last_book_ts = ts
        self.book_dirty = True

    def on_ticker(self, patch):
        hint = patch.pop("last_hint", None)
        if hint and not self.ticker["last"]:
            self.ticker["last"] = self.ticker["prev"] = hint
        self.ticker.update(patch)

    def set_latency(self, ms):
        self.latency = ms

    # ---- recording ----
    def _record(self, candle):
        async def ins():
            try:
                await db.candles.update_one(
                    {"exchange": self.exchange, "symbol": self.symbol,
                     "market_type": self.market_type, "tf": self.tf, "t": candle["t"]},
                    {"$set": {**candle, "exchange": self.exchange, "symbol": self.symbol,
                              "market_type": self.market_type, "tf": self.tf,
                              "recorded_at": __import__("datetime").datetime.now(
                                  __import__("datetime").timezone.utc)}},
                    upsert=True)
            except Exception:
                pass
        asyncio.create_task(ins())

    # ---- lifecycle ----
    async def start(self):
        try:
            await self.provider.seed(self)
        except Exception:
            pass
        self.tasks.append(asyncio.create_task(self._run_provider()))
        self.tasks.append(asyncio.create_task(self._loop()))

    async def _run_provider(self):
        try:
            await self.provider.run(self)
        except Exception:
            if not self.stopped:
                self.set_status("error", f"{self.exchange} · feed error")

    async def _loop(self):
        tick = 0
        while not self.stopped:
            await asyncio.sleep(0.12)
            tick += 1
            if tick % 8 == 0:  # ~1s
                self.msg_rate = self.msg_count
                self.msg_count = 0
            if self.status == "live" and self.last_msg_ts and now_ms() - self.last_msg_ts > STALE_MS:
                self.status = "stale"
                self.source = f"{self.exchange} · STALE DATA (no messages)"
            if not self.clients:
                if self._empty_since is None:
                    self._empty_since = now_ms()
                elif now_ms() - self._empty_since > IDLE_STOP_S * 1000:
                    break
                continue
            self._empty_since = None
            await self._broadcast()
        await self.stop()
        self.hub.sessions.pop(self.key, None)

    def build_snapshot(self):
        return {"type": "snapshot", "state": {
            "exchange": self.exchange, "symbol": self.symbol, "tf": self.tf,
            "marketType": self.market_type, "depth": self.depth,
            "status": self.status, "source": self.source, "latency": self.latency,
            "msgRate": self.msg_rate, "tick": self.tick, "ticker": dict(self.ticker),
            "book": self.book, "trades": list(self.trades),
            "candles": self.candles, "pdh": self.pdh, "pdl": self.pdl,
            "lastBookUpdate": self.last_book_ts}}

    def _build_patch(self):
        p = {"type": "patch", "status": self.status, "source": self.source,
             "latency": self.latency, "msgRate": self.msg_rate, "tick": self.tick,
             "ticker": dict(self.ticker), "pdh": self.pdh, "pdl": self.pdl}
        if self.book_dirty:
            p["book"] = self.book
            p["lastBookUpdate"] = self.last_book_ts
            self.book_dirty = False
        if self.changed:
            p["candles"] = [self.index[t] for t in sorted(self.changed) if t in self.index]
            self.changed.clear()
        if self.pending_trades:
            p["trades"] = list(reversed(self.pending_trades))  # newest first
            self.pending_trades = []
        return p

    async def _broadcast(self):
        patch = self._build_patch()
        dead = []
        for ws in list(self.clients.keys()):
            try:
                await ws.send_json(patch)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.clients.pop(ws, None)

    async def stop(self):
        self.stopped = True
        for t in self.tasks:
            t.cancel()


class MarketHub:
    def __init__(self):
        self.sessions = {}
        self.lock = asyncio.Lock()

    @staticmethod
    def _key(exchange, symbol, market_type, tf):
        return f"{exchange}|{symbol}|{market_type}|{tf}"

    async def subscribe(self, ws, exchange, symbol, market_type, tf, depth):
        exchange = exchange.upper()
        symbol = symbol.upper()
        key = self._key(exchange, symbol, market_type, tf)
        async with self.lock:
            s = self.sessions.get(key)
            if s is None or s.stopped:
                s = Session(self, key, exchange, symbol, market_type, tf)
                self.sessions[key] = s
                s.clients[ws] = depth
                await s.start()
            else:
                s.clients[ws] = depth
        return s

    def remove_client(self, ws):
        for s in list(self.sessions.values()):
            s.clients.pop(ws, None)

    def feed_stats(self):
        out = []
        for name in ["BINANCE", "BYBIT", "GATE.IO"]:
            sess = [s for s in self.sessions.values() if s.exchange == name]
            live = [s for s in sess if s.status == "live"]
            if name == "GATE.IO":
                out.append({"exchange": name, "status": "disconnected", "rate": 0,
                            "last_tick": None, "last_book": None, "connected_at": None,
                            "reconnects": 0, "latency_ms": None, "last_price": 0,
                            "messages": 0, "error": "Coming Later"})
                continue
            if not sess:
                out.append({"exchange": name, "status": "idle", "rate": 0,
                            "last_tick": None, "last_book": None, "connected_at": None,
                            "reconnects": 0, "latency_ms": None, "last_price": 0,
                            "messages": 0, "error": "No active subscriptions"})
                continue
            status = "connected" if live else (
                "connecting" if any(s.status == "connecting" for s in sess) else "disconnected")
            rate = sum(s.msg_rate for s in sess)
            last_tick = max((s.last_trade_ts for s in sess), default=0)
            last_book = max((s.last_book_ts for s in sess), default=0)
            conn = min((s.connected_at for s in sess if s.connected_at), default=None)
            lat = [s.latency for s in sess if s.latency]
            price = next((s.ticker["last"] for s in sess if s.ticker["last"]), 0)
            err = None
            if not live:
                err = next((s.source for s in sess), None)
            out.append({
                "exchange": name, "status": status, "rate": rate,
                "last_tick": _iso(last_tick), "last_book": _iso(last_book),
                "connected_at": _iso(conn), "reconnects": sum(s.reconnects for s in sess),
                "latency_ms": round(sum(lat) / len(lat)) if lat else None,
                "last_price": price, "messages": sum(s.total_msgs for s in sess),
                "error": err})
        return out

    def active_clients(self):
        return sum(len(s.clients) for s in self.sessions.values())

    async def shutdown(self):
        for s in list(self.sessions.values()):
            await s.stop()


def _iso(ms):
    if not ms:
        return None
    import datetime
    return datetime.datetime.fromtimestamp(ms / 1000, datetime.timezone.utc).isoformat()


hub = MarketHub()
