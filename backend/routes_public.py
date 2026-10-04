from fastapi import APIRouter
from pydantic import BaseModel, EmailStr

from db import db, now_iso
from hub import hub
from exchanges.binance import BinanceProvider
from exchanges.bybit import BybitProvider, GateProvider

router = APIRouter(tags=["public"])

PLANS = [
    {"id": "free", "name": "Starter", "price": 0, "period": "mo", "highlight": False,
     "tagline": "Live order flow to get you started.",
     "features": ["Binance spot live feed", "Footprint, delta & CVD", "DOM up to 50 levels",
                  "5 price alerts", "Trade journal"]},
    {"id": "pro", "name": "Pro", "price": 49, "period": "mo", "highlight": True,
     "tagline": "The full order-flow terminal.",
     "features": ["Binance + Bybit (spot & perp)", "Full footprint & volume profile",
                  "DOM up to 1000 levels", "100 alerts + signals", "Replay & backtesting",
                  "Priority feeds"]},
    {"id": "institutional", "name": "Enterprise", "price": 199, "period": "mo", "highlight": False,
     "tagline": "For desks and teams.",
     "features": ["Everything in Pro", "Unlimited alerts", "Extended data retention",
                  "Admin & team controls", "Dedicated support"]},
]


@router.get("/plans")
async def plans():
    return PLANS


class ContactIn(BaseModel):
    name: str
    email: EmailStr
    message: str


@router.post("/contact")
async def contact(body: ContactIn):
    await db.contacts.insert_one({**body.model_dump(), "created_at": now_iso()})
    return {"ok": True}


@router.get("/exchanges")
async def exchanges():
    return {
        "BINANCE": BinanceProvider().capabilities(),
        "BYBIT": BybitProvider().capabilities(),
        "GATE.IO": GateProvider().capabilities(),
    }


@router.get("/market/recorded")
async def recorded(exchange: str, symbol: str, tf: str = "1m",
                   market_type: str = "spot", limit: int = 400):
    rows = await db.candles.find(
        {"exchange": exchange.upper(), "symbol": symbol.upper(),
         "market_type": market_type, "tf": tf},
        {"_id": 0, "recorded_at": 0}).sort("t", 1).to_list(min(limit, 1000))
    return {"count": len(rows), "candles": rows}


@router.get("/system/health")
async def health():
    try:
        await db.command("ping")
        db_ok = True
    except Exception:
        db_ok = False
    return {
        "backend": "ok",
        "database": "ok" if db_ok else "error",
        "feeds": hub.feed_stats(),
        "activeConnections": hub.active_clients(),
        "time": now_iso(),
    }
