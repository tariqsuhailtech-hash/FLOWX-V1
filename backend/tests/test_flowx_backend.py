"""FLOWX backend end-to-end tests covering auth, user CRUD, public, admin and WS pipeline."""
import os
import json
import time
import uuid
import asyncio

import pytest
import requests
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://orderflow-analytics-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
WS_URL = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + "/api/ws/market"

ADMIN = {"email": "admin@flowx.com", "password": "password"}
USER = {"email": "masteruser@flowx.com", "password": "password"}


@pytest.fixture(scope="session")
def user_token():
    r = requests.post(f"{API}/auth/login", json=USER, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def auth(t):
    return {"Authorization": f"Bearer {t}"}


# ---------- Auth ----------
class TestAuth:
    def test_register_new_user(self):
        email = f"TEST_{uuid.uuid4().hex[:8]}@flowx.com"
        r = requests.post(f"{API}/auth/register", json={"email": email, "password": "password123", "name": "T"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and data["user"]["email"] == email.lower()
        assert data["user"]["role"] == "user"

    def test_login_user(self, user_token):
        assert isinstance(user_token, str) and len(user_token) > 20

    def test_login_admin(self, admin_token):
        assert isinstance(admin_token, str)

    def test_me_user(self, user_token):
        r = requests.get(f"{API}/auth/me", headers=auth(user_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == USER["email"] and d["role"] == "user"

    def test_me_admin(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers=auth(admin_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_login_bad(self):
        r = requests.post(f"{API}/auth/login", json={"email": "nope@x.com", "password": "xxxxx"}, timeout=15)
        assert r.status_code == 401

    def test_logout(self):
        r = requests.post(f"{API}/auth/logout", timeout=15)
        assert r.status_code == 200


# ---------- Role protection ----------
class TestRoleProtection:
    @pytest.mark.parametrize("ep", ["/admin/overview", "/admin/users", "/admin/settings"])
    def test_user_forbidden(self, user_token, ep):
        r = requests.get(f"{API}{ep}", headers=auth(user_token), timeout=15)
        assert r.status_code == 403

    @pytest.mark.parametrize("ep", ["/admin/overview", "/admin/users", "/admin/settings"])
    def test_admin_allowed(self, admin_token, ep):
        r = requests.get(f"{API}{ep}", headers=auth(admin_token), timeout=15)
        assert r.status_code == 200

    def test_no_auth_401(self):
        r = requests.get(f"{API}/admin/overview", timeout=15)
        assert r.status_code == 401


# ---------- Public ----------
class TestPublic:
    def test_plans(self):
        r = requests.get(f"{API}/plans", timeout=15)
        assert r.status_code == 200
        plans = r.json()
        assert len(plans) == 3
        ids = {p["id"] for p in plans}
        assert ids == {"free", "pro", "institutional"}

    def test_exchanges(self):
        r = requests.get(f"{API}/exchanges", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["BINANCE"]["spot"] is True
        assert d["BINANCE"]["perp"] is False
        assert d["BYBIT"]["spot"] is True and d["BYBIT"]["perp"] is True
        assert d["GATE.IO"]["spot"] is False and d["GATE.IO"]["perp"] is False

    def test_health(self):
        r = requests.get(f"{API}/system/health", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["backend"] == "ok"
        assert "feeds" in d

    def test_contact(self):
        r = requests.post(f"{API}/contact", json={"name": "T", "email": "t@x.com", "message": "hi"}, timeout=15)
        assert r.status_code == 200

    def test_recorded_candles(self):
        r = requests.get(f"{API}/market/recorded", params={"exchange": "BINANCE", "symbol": "BTCUSDT", "tf": "1m"}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "candles" in d and "count" in d


# ---------- User CRUD ----------
class TestUserData:
    def test_settings(self, user_token):
        r = requests.put(f"{API}/me/settings", json={"theme": "dark"}, headers=auth(user_token), timeout=15)
        assert r.status_code == 200
        assert r.json().get("theme") == "dark"

    def test_profile(self, user_token):
        r = requests.put(f"{API}/me/profile", json={"name": "Master Tester"}, headers=auth(user_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["name"] == "Master Tester"

    def test_favorites(self, user_token):
        r = requests.put(f"{API}/me/favorites", json={"symbols": ["btcusdt", "ethusdt", "solusdt"]}, headers=auth(user_token), timeout=15)
        assert r.status_code == 200
        favs = r.json()["favorites"]
        assert favs == ["BTCUSDT", "ETHUSDT", "SOLUSDT"]

    def test_usage(self, user_token):
        r = requests.get(f"{API}/me/usage", headers=auth(user_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "limits" in d and "alerts" in d

    def test_heartbeat(self, user_token):
        r = requests.post(f"{API}/me/heartbeat", headers=auth(user_token), timeout=15)
        assert r.status_code == 200

    def test_alerts_crud(self, user_token):
        h = auth(user_token)
        r = requests.post(f"{API}/me/alerts", json={"symbol": "btcusdt", "condition": ">", "value": 100000, "note": "x"}, headers=h, timeout=15)
        assert r.status_code == 200
        aid = r.json()["id"]
        assert r.json()["symbol"] == "BTCUSDT"
        r = requests.get(f"{API}/me/alerts", headers=h, timeout=15)
        assert r.status_code == 200 and any(a["id"] == aid for a in r.json())
        r = requests.patch(f"{API}/me/alerts/{aid}", json={"enabled": False}, headers=h, timeout=15)
        assert r.status_code == 200 and r.json()["enabled"] is False
        r = requests.delete(f"{API}/me/alerts/{aid}", headers=h, timeout=15)
        assert r.status_code == 200

    def test_signals(self, user_token):
        h = auth(user_token)
        r = requests.post(f"{API}/me/signals", json={"symbol": "BTCUSDT", "exchange": "BINANCE", "bias": "long",
                                                      "confidence": "high", "score": 0.8, "price": 100000, "factors": ["cvd"]},
                          headers=h, timeout=15)
        assert r.status_code == 200
        r = requests.get(f"{API}/me/signals", headers=h, timeout=15)
        assert r.status_code == 200

    def test_layouts(self, user_token):
        h = auth(user_token)
        r = requests.post(f"{API}/me/layouts", json={"name": "L1", "config": {"a": 1}}, headers=h, timeout=15)
        assert r.status_code == 200
        lid = r.json()["id"]
        r = requests.get(f"{API}/me/layouts", headers=h, timeout=15)
        assert r.status_code == 200
        r = requests.delete(f"{API}/me/layouts/{lid}", headers=h, timeout=15)
        assert r.status_code == 200

    def test_journal_pnl(self, user_token):
        h = auth(user_token)
        r = requests.post(f"{API}/me/journal", json={"symbol": "btcusdt", "side": "long", "entry": 100, "exit": 110, "size": 2},
                          headers=h, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["pnl"] == 20.0 and d["symbol"] == "BTCUSDT"
        jid = d["id"]
        r = requests.get(f"{API}/me/journal", headers=h, timeout=15)
        assert any(j["id"] == jid for j in r.json())
        r = requests.delete(f"{API}/me/journal/{jid}", headers=h, timeout=15)
        assert r.status_code == 200


# ---------- Admin ----------
class TestAdmin:
    def test_overview(self, admin_token):
        r = requests.get(f"{API}/admin/overview", headers=auth(admin_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["totalUsers"] >= 2
        assert isinstance(d["feeds"], list)

    def test_users(self, admin_token):
        r = requests.get(f"{API}/admin/users", headers=auth(admin_token), timeout=15)
        assert r.status_code == 200
        users = r.json()
        assert any(u["email"] == USER["email"] for u in users)

    def test_patch_user(self, admin_token):
        r = requests.get(f"{API}/admin/users", headers=auth(admin_token), timeout=15)
        users = r.json()
        target = next(u for u in users if u["email"] == USER["email"])
        r = requests.patch(f"{API}/admin/users/{target['id']}", json={"plan": "pro"}, headers=auth(admin_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["plan"] == "pro"

    def test_settings(self, admin_token):
        r = requests.get(f"{API}/admin/settings", headers=auth(admin_token), timeout=15)
        assert r.status_code == 200
        r = requests.put(f"{API}/admin/settings", json={"alertCooldownSec": 45}, headers=auth(admin_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["alertCooldownSec"] == 45


# ---------- Real WS pipeline ----------
async def _subscribe(exchange, symbol, market_type, timeout=25):
    """Connect, subscribe, collect messages until snapshot+some patches or timeout."""
    snapshot = None
    patches = []
    try:
        async with websockets.connect(WS_URL, open_timeout=15, close_timeout=5) as ws:
            await ws.send(json.dumps({"action": "subscribe", "exchange": exchange, "symbol": symbol,
                                      "marketType": market_type, "tf": "1m", "depth": 20}))
            end = time.time() + timeout
            while time.time() < end:
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=end - time.time())
                except asyncio.TimeoutError:
                    break
                data = json.loads(msg)
                if data.get("type") == "snapshot":
                    snapshot = data
                elif data.get("type") == "patch":
                    patches.append(data)
                    if len(patches) >= 3 and snapshot:
                        break
    except Exception as e:
        return {"error": str(e), "snapshot": snapshot, "patches": patches}
    return {"snapshot": snapshot, "patches": patches}


class TestWSPipeline:
    def test_binance_spot_live(self):
        result = asyncio.run(_subscribe("BINANCE", "BTCUSDT", "spot", timeout=25))
        snap = result.get("snapshot")
        assert snap is not None, f"No snapshot received: {result}"
        state = snap.get("state", {})
        status = state.get("status")
        assert status in ("live", "connecting", "connected"), f"Unexpected status: {status}"
        # Need live for real test
        if status == "live":
            ticker = state.get("ticker", {})
            last = ticker.get("last") or 0
            assert last > 1000, f"BTC last price looks fake: {last}"

    def test_bybit_spot_live(self):
        result = asyncio.run(_subscribe("BYBIT", "BTCUSDT", "spot", timeout=25))
        snap = result.get("snapshot")
        assert snap is not None, f"No snapshot: {result}"
        status = snap.get("state", {}).get("status")
        assert status in ("live", "connecting", "connected"), f"status={status}"

    def test_bybit_perp_live(self):
        result = asyncio.run(_subscribe("BYBIT", "BTCUSDT", "perp", timeout=25))
        snap = result.get("snapshot")
        assert snap is not None
        status = snap.get("state", {}).get("status")
        assert status in ("live", "connecting", "connected"), f"status={status}"

    def test_binance_perp_disconnected(self):
        """Binance perp is geo-blocked -> MUST show disconnected, not fake data."""
        result = asyncio.run(_subscribe("BINANCE", "BTCUSDT", "perp", timeout=15))
        snap = result.get("snapshot")
        assert snap is not None
        status = snap.get("state", {}).get("status")
        assert status in ("disconnected", "unavailable", "connecting"), f"Binance perp should be disconnected, got: {status}"

    def test_gateio_disconnected(self):
        result = asyncio.run(_subscribe("GATE.IO", "BTCUSDT", "spot", timeout=10))
        snap = result.get("snapshot")
        assert snap is not None
        status = snap.get("state", {}).get("status")
        # Gate.io is "Coming Later" - must never show live. Accept disconnected/unavailable/connecting (but should never be 'live').
        assert status != "live", f"Gate.io must not be live, got: {status}"
        assert status in ("disconnected", "unavailable", "connecting"), f"status={status}"
