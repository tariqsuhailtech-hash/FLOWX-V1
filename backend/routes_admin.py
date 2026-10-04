from datetime import datetime, timezone, timedelta

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from db import db, serialize_user, now_iso, PLAN_PRICE
from auth import admin_user
from hub import hub

router = APIRouter(prefix="/admin", tags=["admin"])

DEFAULT_SYS = {
    "exchanges": {"BINANCE": True, "BYBIT": True, "GATE.IO": False},
    "symbols": ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"],
    "dataRetentionDays": 7,
    "alertCooldownSec": 30,
    "imbalanceThreshold": 3,
    "absorptionThreshold": 1.8,
    "rateLimitPerMin": 120,
    "featureFlags": {"footprint": True, "heatmap": True, "replay": True,
                     "backtest": True, "paperTrading": True},
}


async def ensure_sys():
    doc = await db.system_settings.find_one({"_id": "global"})
    if not doc:
        doc = {"_id": "global", **DEFAULT_SYS, "updated_at": now_iso()}
        await db.system_settings.insert_one(doc)
    return doc


def _since(minutes):
    return (datetime.now(timezone.utc) - timedelta(minutes=minutes)).isoformat()


@router.get("/overview")
async def overview(admin=Depends(admin_user)):
    total = await db.users.count_documents({})
    active = await db.users.count_documents({"last_seen": {"$gte": _since(24 * 60)}})
    online = await db.users.count_documents({"last_seen": {"$gte": _since(2)}})
    subs = await db.users.count_documents({"plan": {"$ne": "free"}})
    paid = await db.users.find({"plan": {"$ne": "free"}}, {"plan": 1}).to_list(10000)
    mrr = sum(PLAN_PRICE.get(u.get("plan", "free"), 0) for u in paid)
    feeds = hub.feed_stats()
    live_feeds = [f for f in feeds if f["status"] == "connected"]
    lats = [f["latency_ms"] for f in feeds if f.get("latency_ms")]
    try:
        await db.command("ping")
        db_ok = True
    except Exception:
        db_ok = False
    return {
        "totalUsers": total, "activeUsers": active, "onlineUsers": online,
        "subscriptions": subs, "mrr": mrr,
        "apiConnections": hub.active_clients(),
        "wsHealth": 100 if (not feeds or live_feeds or hub.active_clients() == 0) else 50,
        "feeds": feeds,
        "systemLatencyMs": round(sum(lats) / len(lats)) if lats else 0,
        "errorRate": 0 if db_ok else 100,
        "dbStatus": "ok" if db_ok else "error",
    }


@router.get("/users")
async def list_users(admin=Depends(admin_user)):
    rows = await db.users.find({}).sort("created_at", -1).to_list(2000)
    return [serialize_user(r) for r in rows]


@router.patch("/users/{uid}")
async def patch_user(uid: str, patch: dict, admin=Depends(admin_user)):
    allowed = {k: v for k, v in patch.items() if k in ("plan", "status", "role")}
    try:
        oid = ObjectId(uid)
    except Exception:
        raise HTTPException(400, "Invalid user id")
    await db.users.update_one({"_id": oid}, {"$set": allowed})
    doc = await db.users.find_one({"_id": oid})
    if not doc:
        raise HTTPException(404, "User not found")
    return serialize_user(doc)


@router.get("/settings")
async def get_sys(admin=Depends(admin_user)):
    doc = await ensure_sys()
    doc.pop("_id", None)
    return doc


@router.put("/settings")
async def put_sys(patch: dict, admin=Depends(admin_user)):
    await ensure_sys()
    patch = {k: v for k, v in patch.items() if k != "_id"}
    patch["updated_at"] = now_iso()
    await db.system_settings.update_one({"_id": "global"}, {"$set": patch})
    doc = await db.system_settings.find_one({"_id": "global"})
    doc.pop("_id", None)
    return doc
