import asyncio
import json

import httpx
import websockets

from exchanges.base import BaseExchangeProvider
from fputil import TF_MS, level_key, new_candle, add_trade
from db import now_ms

REST = "https://data-api.binance.vision/api/v3"
WS = "wss://data-stream.binance.vision/stream?streams="


class BinanceProvider(BaseExchangeProvider):
    name = "BINANCE"

    def capabilities(self):
        # Spot public market data is reachable from the server region.
        # USDⓈ-M futures (fapi/fstream) is geo-restricted (451) from here.
        return {"spot": True, "perp": False, "history": True}

    async def seed(self, session):
        if session.market_type != "spot":
            return
        sym = session.symbol
        tf = session.tf
        tick = session.tick
        tfms = TF_MS[tf]
        async with httpx.AsyncClient(timeout=12) as c:
            try:
                kl, days, tick24 = await asyncio.gather(
                    c.get(f"{REST}/klines", params={"symbol": sym, "interval": tf, "limit": 150}),
                    c.get(f"{REST}/klines", params={"symbol": sym, "interval": "1d", "limit": 2}),
                    c.get(f"{REST}/ticker/24hr", params={"symbol": sym}),
                )
                rows = kl.json()
                if not isinstance(rows, list):
                    return
                candles = []
                for r in rows:
                    t = int(r[0])
                    o, h, l, cl = float(r[1]), float(r[2]), float(r[3]), float(r[4])
                    vol = float(r[5])
                    buy = float(r[9])  # taker buy base volume (real)
                    sell = max(0.0, vol - buy)
                    cd = new_candle(t, o)
                    cd.update({"h": h, "l": l, "c": cl, "vol": vol, "buy": buy,
                               "sell": sell, "delta": buy - sell,
                               "maxDelta": max(0.0, buy - sell),
                               "minDelta": min(0.0, buy - sell)})
                    candles.append(cd)
                session.set_candles(candles)
                # Real footprint cells for the most recent bars from aggregated trades.
                try:
                    agg = (await c.get(f"{REST}/aggTrades", params={"symbol": sym, "limit": 1000})).json()
                    if isinstance(agg, list):
                        idx = {cd["t"]: cd for cd in candles}
                        for a in agg:
                            t = (int(a["T"]) // tfms) * tfms
                            cd = idx.get(t)
                            if cd is None:
                                continue
                            price = float(a["p"])
                            qty = float(a["q"])
                            side = "sell" if a["m"] else "buy"
                            k = level_key(price, tick)
                            cell = cd["cells"].get(k) or cd["cells"].setdefault(k, {"bid": 0.0, "ask": 0.0})
                            if side == "buy":
                                cell["ask"] += qty
                            else:
                                cell["bid"] += qty
                except Exception:
                    pass
                d = days.json()
                if isinstance(d, list) and len(d) >= 2:
                    session.pdh = float(d[0][2])
                    session.pdl = float(d[0][3])
                tk = tick24.json()
                if isinstance(tk, dict) and tk.get("lastPrice"):
                    session.seed_ticker({
                        "last": float(tk["lastPrice"]),
                        "changePct": float(tk.get("priceChangePercent", 0)),
                        "change": float(tk.get("priceChange", 0)),
                        "volume": float(tk.get("volume", 0)),
                        "quoteVolume": float(tk.get("quoteVolume", 0)),
                        "high": float(tk.get("highPrice", 0)),
                        "low": float(tk.get("lowPrice", 0)),
                    })
            except Exception:
                return

    async def run(self, session):
        if session.market_type != "spot":
            session.set_status(
                "disconnected",
                "BINANCE USDⓈ-M PERP · unavailable from server region — select Bybit for perpetuals",
            )
            while not session.stopped:
                await asyncio.sleep(1)
            return

        sym = session.symbol.lower()
        url = WS + "/".join([f"{sym}@aggTrade", f"{sym}@depth20@100ms", f"{sym}@ticker"])
        poll = asyncio.create_task(self._depth_poll(session))
        try:
            while not session.stopped:
                try:
                    async with websockets.connect(url, open_timeout=10, ping_interval=20,
                                                   close_timeout=3, max_size=2 ** 22) as ws:
                        session.set_status("live", "BINANCE · SPOT")
                        session.mark_connected()
                        async for raw in ws:
                            if session.stopped:
                                break
                            msg = json.loads(raw)
                            stream = msg.get("stream", "")
                            d = msg.get("data", {})
                            if stream.endswith("aggTrade"):
                                session.on_trade(float(d["p"]), float(d["q"]),
                                                 "sell" if d["m"] else "buy",
                                                 int(d["T"]), int(d.get("E") or 0) or None)
                            elif "@depth" in stream:
                                if session.depth <= 20:
                                    session.on_book(
                                        [[float(p), float(q)] for p, q in d.get("bids", [])],
                                        [[float(p), float(q)] for p, q in d.get("asks", [])],
                                        now_ms())
                            elif stream.endswith("ticker"):
                                session.on_ticker({
                                    "changePct": float(d["P"]), "change": float(d["p"]),
                                    "volume": float(d["v"]), "quoteVolume": float(d["q"]),
                                    "high": float(d["h"]), "low": float(d["l"])})
                                session.inc_msg()
                except Exception as e:
                    if session.stopped:
                        break
                    session.note_reconnect()
                    session.set_status("reconnecting", f"BINANCE · reconnecting")
                    await asyncio.sleep(2)
        finally:
            poll.cancel()

    async def _depth_poll(self, session):
        while not session.stopped:
            try:
                if session.depth > 20 and session.market_type == "spot":
                    lim = 50 if session.depth <= 50 else 100 if session.depth <= 100 else 500 if session.depth <= 500 else 1000
                    async with httpx.AsyncClient(timeout=8) as c:
                        r = (await c.get(f"{REST}/depth",
                                         params={"symbol": session.symbol, "limit": lim})).json()
                    if isinstance(r, dict) and r.get("bids"):
                        session.on_book(
                            [[float(p), float(q)] for p, q in r["bids"][:session.depth]],
                            [[float(p), float(q)] for p, q in r["asks"][:session.depth]],
                            now_ms())
            except Exception:
                pass
            await asyncio.sleep(1.2)
