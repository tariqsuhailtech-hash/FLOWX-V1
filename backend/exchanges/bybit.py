import asyncio
import json

import websockets

from exchanges.base import BaseExchangeProvider
from db import now_ms

WS = "wss://stream.bybit.com/v5/public/"


class BybitProvider(BaseExchangeProvider):
    name = "BYBIT"

    def capabilities(self):
        # WS (spot + linear) reachable from server. REST is CloudFront geo-blocked
        # -> no historical seeding; candles are built live from the trade stream.
        return {"spot": True, "perp": True, "history": False}

    async def run(self, session):
        cat = "linear" if session.market_type == "perp" else "spot"
        url = WS + cat
        sym = session.symbol.upper()
        depth_topic = 50 if session.depth <= 50 else 200
        label = "PERPETUAL" if cat == "linear" else "SPOT"
        args = [f"publicTrade.{sym}", f"orderbook.{depth_topic}.{sym}", f"tickers.{sym}"]
        while not session.stopped:
            book = {"b": {}, "a": {}}
            try:
                async with websockets.connect(url, open_timeout=10, ping_interval=20,
                                               close_timeout=3, max_size=2 ** 22) as ws:
                    await ws.send(json.dumps({"op": "subscribe", "args": args}))
                    session.set_status("connecting", f"BYBIT · {label}")
                    async for raw in ws:
                        if session.stopped:
                            break
                        m = json.loads(raw)
                        if m.get("op") == "subscribe":
                            session.set_status("live", f"BYBIT · {label}")
                            session.mark_connected()
                            continue
                        topic = m.get("topic", "")
                        if topic.startswith("publicTrade"):
                            for t in m.get("data", []):
                                side = "buy" if t.get("S") == "Buy" else "sell"
                                session.on_trade(float(t["p"]), float(t["v"]), side,
                                                 int(t["T"]), int(t["T"]))
                        elif topic.startswith("orderbook"):
                            d = m.get("data", {})
                            if m.get("type") == "snapshot":
                                book = {"b": {}, "a": {}}
                            for p, q in d.get("b", []):
                                q = float(q)
                                if q == 0:
                                    book["b"].pop(p, None)
                                else:
                                    book["b"][p] = q
                            for p, q in d.get("a", []):
                                q = float(q)
                                if q == 0:
                                    book["a"].pop(p, None)
                                else:
                                    book["a"][p] = q
                            bids = sorted(([float(p), q] for p, q in book["b"].items()),
                                          key=lambda x: -x[0])[:200]
                            asks = sorted(([float(p), q] for p, q in book["a"].items()),
                                          key=lambda x: x[0])[:200]
                            session.on_book(bids, asks, int(m.get("ts", now_ms())))
                            session.inc_msg()
                        elif topic.startswith("tickers"):
                            d = m.get("data", {})
                            patch = {}
                            lp = d.get("lastPrice")
                            if lp:
                                patch["last_hint"] = float(lp)
                            pc = d.get("price24hPcnt")
                            if pc not in (None, ""):
                                patch["changePct"] = float(pc) * 100
                            if d.get("highPrice24h"):
                                patch["high"] = float(d["highPrice24h"])
                            if d.get("lowPrice24h"):
                                patch["low"] = float(d["lowPrice24h"])
                            if d.get("volume24h"):
                                patch["volume"] = float(d["volume24h"])
                            if d.get("turnover24h"):
                                patch["quoteVolume"] = float(d["turnover24h"])
                            session.on_ticker(patch)
                            session.inc_msg()
            except Exception:
                if session.stopped:
                    break
                session.note_reconnect()
                session.set_status("reconnecting", f"BYBIT · {label} reconnecting")
                await asyncio.sleep(2)


class GateProvider(BaseExchangeProvider):
    name = "GATE.IO"

    def capabilities(self):
        return {"spot": False, "perp": False, "history": False}

    async def run(self, session):
        session.set_status("disconnected",
                           "GATE.IO · Coming Later — data provider not configured")
        while not session.stopped:
            await asyncio.sleep(1)
