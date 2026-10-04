import uuid

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db import db, serialize_user, now_iso, PLAN_LIMITS
from auth import current_user

router = APIRouter(prefix="/me", tags=["user"])


def _uid(user):
    return str(user["_id"])


# ---------- profile / settings ----------
@router.post("/heartbeat")
async def heartbeat(user=Depends(current_user)):
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"last_seen": now_iso()}})
    return {"ok": True}


@router.put("/settings")
async def update_settings(patch: dict, user=Depends(current_user)):
    settings = {**(user.get("settings") or {}), **patch}
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"settings": settings}})
    return settings


class ProfileIn(BaseModel):
    name: str


@router.put("/profile")
async def update_profile(body: ProfileIn, user=Depends(current_user)):
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"name": body.name.strip()}})
    doc = await db.users.find_one({"_id": user["_id"]})
    return serialize_user(doc)


class FavIn(BaseModel):
    symbols: list


@router.put("/favorites")
async def update_favorites(body: FavIn, user=Depends(current_user)):
    favs = [s.upper() for s in body.symbols][:20]
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"favorites": favs}})
    return {"favorites": favs}


@router.get("/usage")
async def usage(user=Depends(current_user)):
    uid = _uid(user)
    return {
        "alerts": await db.alerts.count_documents({"user_id": uid}),
        "signals": await db.signals.count_documents({"user_id": uid}),
        "journal": await db.journal.count_documents({"user_id": uid}),
        "sessions": user.get("login_count", 0),
        "lastLogin": user.get("last_seen"),
        "limits": PLAN_LIMITS.get(user.get("plan", "free"), PLAN_LIMITS["free"]),
    }


# ---------- alerts ----------
class AlertIn(BaseModel):
    symbol: str
    condition: str
    value: float
    note: str = ""


@router.get("/alerts")
async def get_alerts(user=Depends(current_user)):
    rows = await db.alerts.find({"user_id": _uid(user)}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return rows


@router.post("/alerts")
async def create_alert(body: AlertIn, user=Depends(current_user)):
    doc = {"id": str(uuid.uuid4()), "user_id": _uid(user), "symbol": body.symbol.upper(),
           "condition": body.condition, "value": body.value, "note": body.note,
           "enabled": True, "triggered_at": None, "created_at": now_iso()}
    await db.alerts.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@router.patch("/alerts/{aid}")
async def patch_alert(aid: str, patch: dict, user=Depends(current_user)):
    allowed = {k: v for k, v in patch.items() if k in ("enabled", "triggered_at", "value", "note")}
    await db.alerts.update_one({"id": aid, "user_id": _uid(user)}, {"$set": allowed})
    doc = await db.alerts.find_one({"id": aid, "user_id": _uid(user)}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Alert not found")
    return doc


@router.delete("/alerts/{aid}")
async def delete_alert(aid: str, user=Depends(current_user)):
    await db.alerts.delete_one({"id": aid, "user_id": _uid(user)})
    return {"ok": True}


# ---------- signals ----------
class SignalIn(BaseModel):
    symbol: str
    exchange: str
    bias: str
    confidence: str
    score: float
    price: float
    factors: list = []


@router.get("/signals")
async def get_signals(user=Depends(current_user)):
    return await db.signals.find({"user_id": _uid(user)}, {"_id": 0}).sort("created_at", -1).to_list(80)


@router.post("/signals")
async def log_signal(body: SignalIn, user=Depends(current_user)):
    doc = {"id": str(uuid.uuid4()), "user_id": _uid(user), **body.model_dump(),
           "created_at": now_iso()}
    await db.signals.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


# ---------- layouts ----------
class LayoutIn(BaseModel):
    name: str
    config: dict


@router.get("/layouts")
async def get_layouts(user=Depends(current_user)):
    return await db.layouts.find({"user_id": _uid(user)}, {"_id": 0}).sort("created_at", -1).to_list(100)


@router.post("/layouts")
async def create_layout(body: LayoutIn, user=Depends(current_user)):
    doc = {"id": str(uuid.uuid4()), "user_id": _uid(user), "name": body.name,
           "config": body.config, "created_at": now_iso()}
    await db.layouts.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@router.delete("/layouts/{lid}")
async def delete_layout(lid: str, user=Depends(current_user)):
    await db.layouts.delete_one({"id": lid, "user_id": _uid(user)})
    return {"ok": True}


# ---------- journal ----------
class JournalIn(BaseModel):
    symbol: str
    side: str
    entry: float
    exit: float | None = None
    size: float = 0
    setup: str = ""
    notes: str = ""
    rating: int = 3


@router.get("/journal")
async def get_journal(user=Depends(current_user)):
    return await db.journal.find({"user_id": _uid(user)}, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.post("/journal")
async def create_journal(body: JournalIn, user=Depends(current_user)):
    dirn = 1 if body.side == "long" else -1
    pnl = 0.0
    if body.exit is not None:
        pnl = (body.exit - body.entry) * dirn * (body.size or 1)
    doc = {"id": str(uuid.uuid4()), "user_id": _uid(user), **body.model_dump(),
           "symbol": body.symbol.upper(), "pnl": pnl, "created_at": now_iso()}
    await db.journal.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@router.delete("/journal/{jid}")
async def delete_journal(jid: str, user=Depends(current_user)):
    await db.journal.delete_one({"id": jid, "user_id": _uid(user)})
    return {"ok": True}
