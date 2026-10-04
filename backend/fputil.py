import math

# Footprint price-level aggregation tick (cluster size) per symbol.
# Display config only — NOT market data.
TICK = {"BTCUSDT": 10, "ETHUSDT": 1, "SOLUSDT": 0.1, "BNBUSDT": 0.5,
        "XRPUSDT": 0.001, "DOGEUSDT": 0.0001}
TF_MS = {"1m": 60000, "3m": 180000, "5m": 300000, "15m": 900000,
         "30m": 1800000, "1h": 3600000}


def tick_for(symbol, last_price=0.0):
    if symbol in TICK:
        return TICK[symbol]
    p = last_price or 1.0
    if p >= 10000:
        return 10.0
    if p >= 1000:
        return 1.0
    if p >= 100:
        return 0.1
    if p >= 1:
        return 0.01
    return 0.0001


def decimals_of(tick):
    return 0 if tick >= 1 else math.ceil(-math.log10(tick))


def level_num(price, tick):
    q = price / tick
    r = round(q)
    base = r if abs(q - r) < 1e-6 else math.floor(q)
    return round(base * tick, decimals_of(tick))


def level_key(price, tick):
    d = decimals_of(tick)
    return f"{level_num(price, tick):.{d}f}"


def new_candle(t, price):
    return {"t": t, "o": price, "h": price, "l": price, "c": price, "vol": 0.0,
            "buy": 0.0, "sell": 0.0, "delta": 0.0, "maxDelta": 0.0, "minDelta": 0.0,
            "trades": 0, "cells": {}, "approx": False}


def add_trade(c, price, qty, side, tick):
    c["h"] = max(c["h"], price)
    c["l"] = min(c["l"], price)
    c["c"] = price
    c["vol"] += qty
    if side == "buy":
        c["buy"] += qty
        c["delta"] += qty
    else:
        c["sell"] += qty
        c["delta"] -= qty
    c["maxDelta"] = max(c["maxDelta"], c["delta"])
    c["minDelta"] = min(c["minDelta"], c["delta"])
    c["trades"] += 1
    k = level_key(price, tick)
    cell = c["cells"].get(k)
    if cell is None:
        cell = c["cells"][k] = {"bid": 0.0, "ask": 0.0}
    if side == "buy":
        cell["ask"] += qty
    else:
        cell["bid"] += qty
