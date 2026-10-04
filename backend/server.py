from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import logging

from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

from db import client, create_indexes
from auth import router as auth_router, seed_users
from routes_user import router as user_router
from routes_admin import router as admin_router, ensure_sys
from routes_public import router as public_router
from market_ws import router as ws_router
from hub import hub

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("flowx")

app = FastAPI(title="FLOWX Order-Flow Analytics API")

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"service": "FLOWX", "status": "ok"}


api_router.include_router(auth_router)
api_router.include_router(user_router)
api_router.include_router(admin_router)
api_router.include_router(public_router)
api_router.include_router(ws_router)  # websocket at /api/ws/market

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    try:
        await create_indexes()
        await seed_users()
        await ensure_sys()
        logger.info("FLOWX startup complete: indexes, users and system settings seeded")
    except Exception as e:
        logger.exception("startup error: %s", e)


@app.on_event("shutdown")
async def on_shutdown():
    await hub.shutdown()
    client.close()
