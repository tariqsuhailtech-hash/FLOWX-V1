import os
from datetime import datetime, timezone, timedelta

import jwt
import bcrypt
from bson import ObjectId
from fastapi import APIRouter, Request, Response, HTTPException, Depends
from pydantic import BaseModel, EmailStr, Field

from db import db, serialize_user, now_iso

JWT_ALG = "HS256"
TOKEN_DAYS = 7


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def _secret() -> str:
    return os.environ["JWT_SECRET"]


def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_DAYS),
    }
    return jwt.encode(payload, _secret(), algorithm=JWT_ALG)


async def _user_from_token(token: str):
    try:
        payload = jwt.decode(token, _secret(), algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid session")
    try:
        doc = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    except Exception:
        doc = None
    if not doc:
        raise HTTPException(status_code=401, detail="User not found")
    return doc


def _extract_token(request: Request):
    token = request.cookies.get("access_token")
    if not token:
        h = request.headers.get("Authorization", "")
        if h.startswith("Bearer "):
            token = h[7:]
    return token


async def current_user(request: Request):
    token = _extract_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return await _user_from_token(token)


async def admin_user(request: Request):
    user = await current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = ""


class LoginIn(BaseModel):
    email: EmailStr
    password: str


def _set_cookie(resp: Response, token: str):
    resp.set_cookie("access_token", token, httponly=True, secure=True,
                    samesite="none", max_age=TOKEN_DAYS * 86400, path="/")


@router.post("/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    doc = {
        "email": email,
        "password_hash": hash_password(body.password),
        "name": (body.name or email.split("@")[0]).strip(),
        "role": "user",
        "plan": "free",
        "status": "active",
        "settings": {},
        "favorites": ["BTCUSDT", "ETHUSDT"],
        "created_at": now_iso(),
        "last_seen": now_iso(),
        "login_count": 1,
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    token = create_token(str(res.inserted_id), email)
    _set_cookie(response, token)
    return {"token": token, "user": serialize_user(doc)}


@router.post("/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower().strip()
    doc = await db.users.find_one({"email": email})
    if not doc or not verify_password(body.password, doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if doc.get("status") == "suspended":
        raise HTTPException(status_code=403, detail="This account is suspended")
    await db.users.update_one({"_id": doc["_id"]},
                              {"$set": {"last_seen": now_iso()}, "$inc": {"login_count": 1}})
    doc["login_count"] = doc.get("login_count", 0) + 1
    token = create_token(str(doc["_id"]), email)
    _set_cookie(response, token)
    return {"token": token, "user": serialize_user(doc)}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@router.get("/me")
async def me(user=Depends(current_user)):
    return serialize_user(user)


async def seed_users():
    seeds = [
        (os.environ.get("ADMIN_EMAIL", "admin@flowx.com"),
         os.environ.get("ADMIN_PASSWORD", "password"), "admin", "institutional", "Admin"),
        (os.environ.get("SEED_USER_EMAIL", "masteruser@flowx.com"),
         os.environ.get("SEED_USER_PASSWORD", "password"), "user", "pro", "Master User"),
    ]
    for email, pw, role, plan, name in seeds:
        email = email.lower()
        existing = await db.users.find_one({"email": email})
        if not existing:
            await db.users.insert_one({
                "email": email, "password_hash": hash_password(pw), "name": name,
                "role": role, "plan": plan, "status": "active", "settings": {},
                "favorites": ["BTCUSDT", "ETHUSDT", "SOLUSDT"],
                "created_at": now_iso(), "last_seen": now_iso(), "login_count": 0,
            })
        elif not verify_password(pw, existing.get("password_hash", "")):
            await db.users.update_one({"email": email},
                                      {"$set": {"password_hash": hash_password(pw)}})
