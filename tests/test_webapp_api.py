import hashlib
import hmac
from urllib.parse import urlencode

import pytest
from fastapi.testclient import TestClient

from bot.config import settings


def _sign_init_data(user_id: int, bot_token: str) -> str:
    params = {
        "auth_date": "1700000000",
        "user": f'{{"id":{user_id},"first_name":"Test"}}',
    }
    data_check = "\n".join(f"{k}={v}" for k, v in sorted(params.items()))
    secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    h = hmac.new(secret, data_check.encode(), hashlib.sha256).hexdigest()
    return urlencode({**params, "hash": h})


@pytest.fixture
def client(tmp_db_path):
    import asyncio
    from bot.db.store import init_db
    from webapp.main import app
    asyncio.run(init_db(tmp_db_path))
    return TestClient(app)


@pytest.fixture
def headers():
    return {"X-Telegram-Init-Data": _sign_init_data(111, settings.BOT_TOKEN)}


def test_state_empty(client, headers):
    r = client.get("/api/state", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["active_list"] is None
    assert body["archive_count"] == 0


def test_state_requires_auth(client):
    r = client.get("/api/state")
    assert r.status_code == 401


def test_state_blocks_non_whitelisted(client):
    bad = {"X-Telegram-Init-Data": _sign_init_data(999, settings.BOT_TOKEN)}
    r = client.get("/api/state", headers=bad)
    assert r.status_code == 403


def test_new_list_creates_active(client, headers):
    r = client.post("/api/lists/new", headers=headers)
    assert r.status_code == 200
    list_id = r.json()["id"]
    state = client.get("/api/state", headers=headers).json()
    assert state["active_list"]["id"] == list_id
    assert state["active_list"]["items"] == []


def test_new_list_conflict_when_non_empty(client, headers):
    import asyncio
    from bot.db.store import connect
    from bot.services.parser import ParsedItem
    from bot.services.shopping import add_items

    async def seed():
        async with connect() as db:
            await add_items(db, [ParsedItem("Молоко")], user_id=111)
    asyncio.run(seed())

    r = client.post("/api/lists/new", headers=headers)
    assert r.status_code == 409


def test_toggle_archives_when_all_done(client, headers):
    import asyncio
    from bot.db.store import connect
    from bot.services.parser import ParsedItem
    from bot.services.shopping import add_items, get_state

    async def seed():
        async with connect() as db:
            await add_items(db, [ParsedItem("Молоко"), ParsedItem("Хлеб")], user_id=111)
            state = await get_state(db)
            return [i.id for i in state.items]

    ids = asyncio.run(seed())

    r1 = client.post(f"/api/items/{ids[0]}/toggle", headers=headers)
    assert r1.status_code == 200
    assert r1.json()["archived"] is False

    r2 = client.post(f"/api/items/{ids[1]}/toggle", headers=headers)
    assert r2.json()["archived"] is True

    state = client.get("/api/state", headers=headers).json()
    assert state["active_list"] is None
    assert state["archive_count"] == 1
