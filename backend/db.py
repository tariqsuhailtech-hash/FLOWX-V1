import os
from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def now_ms():
    return int(datetime.now(timezone.utc).timestamp() * 1000)


PLAN_PRICE = {"free": 0, "pro": 49, "institutional": 199}
PLAN_LIMITS = {
    "free": {"alerts": 5, "exchanges": 1, "depth": 50},
    "pro": {"alerts": 100, "exchanges": 3, "depth": 1000},
    "institutional": {"alerts": 1000, "exchanges": 3, "depth": 1000},
}


def serialize_user(doc):
    if not doc:
        return None
    return {
        "id": str(doc.get("_id")),
        "email": doc.get("email"),
        "name": doc.get("name"),
        "role": doc.get("role", "user"),
        "plan": doc.get("plan", "free"),
        "status": doc.get("status", "active"),
        "settings": doc.get("settings", {}),
        "favorites": doc.get("favorites", ["BTCUSDT", "ETHUSDT"]),
        "created_at": doc.get("created_at"),
        "last_seen": doc.get("last_seen"),
        "login_count": doc.get("login_count", 0),
    }


async def create_indexes():
    await db.users.create_index("email", unique=True)
    await db.alerts.create_index([("user_id", 1)])
    await db.signals.create_index([("user_id", 1), ("created_at", -1)])
    await db.journal.create_index([("user_id", 1)])
    await db.layouts.create_index([("user_id", 1)])
    # recorded candles: retention TTL (default 7 days) + lookup
    await db.candles.create_index([("exchange", 1), ("symbol", 1), ("market_type", 1), ("tf", 1), ("t", 1)], unique=True)
    try:
        await db.candles.create_index("recorded_at", expireAfterSeconds=7 * 24 * 3600)
    except Exception:
        pass
