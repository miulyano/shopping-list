import asyncio

import pytest
from fastapi.testclient import TestClient

from bot.config import settings
from tests.conftest import sign_init_data


@pytest.fixture
def client(tmp_db_path):
    from bot.db.store import init_db
    from webapp.main import app
    asyncio.run(init_db(tmp_db_path))
    return TestClient(app)


@pytest.fixture
def headers():
    return {"X-Telegram-Init-Data": sign_init_data(111, settings.BOT_TOKEN)}


def _seed_items(names_with_qty):
    from bot.db.store import connect
    from bot.services.parser import ParsedItem
    from bot.services.shopping import add_items, get_state

    async def run():
        async with connect() as db:
            await add_items(
                db,
                [ParsedItem(n, q) for n, q in names_with_qty],
                user_id=111,
            )
            return [i.id for i in (await get_state(db)).items]
    return asyncio.run(run())


def _archive_active():
    from bot.db.store import connect
    from bot.services.shopping import get_archive, get_state, toggle_item

    async def run():
        async with connect() as db:
            state = await get_state(db)
            for it in state.items:
                await toggle_item(db, it.id, user_id=111)
            return (await get_archive(db))[0].id
    return asyncio.run(run())


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
    bad = {"X-Telegram-Init-Data": sign_init_data(999, settings.BOT_TOKEN)}
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
    _seed_items([("Молоко", None)])
    r = client.post("/api/lists/new", headers=headers)
    assert r.status_code == 409


def test_toggle_archives_when_all_done(client, headers):
    ids = _seed_items([("Молоко", None), ("Хлеб", None)])

    r1 = client.post(f"/api/items/{ids[0]}/toggle", headers=headers)
    assert r1.status_code == 200
    assert r1.json()["archived"] is False

    r2 = client.post(f"/api/items/{ids[1]}/toggle", headers=headers)
    assert r2.json()["archived"] is True

    state = client.get("/api/state", headers=headers).json()
    assert state["active_list"] is None
    assert state["archive_count"] == 1


def test_patch_item_updates_name_and_qty(client, headers):
    [item_id] = _seed_items([("Молоко", "1 л")])
    r = client.patch(
        f"/api/items/{item_id}",
        headers=headers,
        json={"name": "Молоко 2,5%", "qty": "2 л"},
    )
    assert r.status_code == 200
    state = client.get("/api/state", headers=headers).json()
    item = state["active_list"]["items"][0]
    assert item["name"] == "Молоко 2,5%"
    assert item["qty"] == "2 л"


def test_patch_item_rejects_blank_name(client, headers):
    [item_id] = _seed_items([("Молоко", "1 л")])
    r = client.patch(
        f"/api/items/{item_id}", headers=headers,
        json={"name": "   ", "qty": ""},
    )
    assert r.status_code == 400


def test_patch_unknown_item_404(client, headers):
    r = client.patch("/api/items/9999", headers=headers, json={"name": "x"})
    assert r.status_code == 404


def test_delete_item_removes_it(client, headers):
    ids = _seed_items([("A", None), ("B", None)])
    r = client.delete(f"/api/items/{ids[0]}", headers=headers)
    assert r.status_code == 200

    state = client.get("/api/state", headers=headers).json()
    assert [i["name"] for i in state["active_list"]["items"]] == ["B"]


def test_delete_unknown_item_404(client, headers):
    r = client.delete("/api/items/9999", headers=headers)
    assert r.status_code == 404


def test_archive_detail_returns_items(client, headers):
    _seed_items([("A", "1"), ("B", None)])
    archived_id = _archive_active()

    r = client.get(f"/api/archive/{archived_id}", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == archived_id
    assert [i["name"] for i in body["items"]] == ["A", "B"]


def test_archive_detail_404_for_active(client, headers):
    _seed_items([("A", None)])
    state = client.get("/api/state", headers=headers).json()
    active_id = state["active_list"]["id"]
    r = client.get(f"/api/archive/{active_id}", headers=headers)
    assert r.status_code == 404


def test_reuse_creates_new_active_when_none(client, headers):
    _seed_items([("Молоко", "1 л"), ("Хлеб", None)])
    archived_id = _archive_active()

    r = client.post(f"/api/archive/{archived_id}/reuse", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["added"] == 2

    state = client.get("/api/state", headers=headers).json()
    items = state["active_list"]["items"]
    assert [i["name"] for i in items] == ["Молоко", "Хлеб"]
    assert all(not i["done"] for i in items)


def test_reuse_unknown_archive_404(client, headers):
    r = client.post("/api/archive/9999/reuse", headers=headers)
    assert r.status_code == 404


def test_delete_archive_removes_it(client, headers):
    _seed_items([("A", None)])
    archived_id = _archive_active()

    r = client.delete(f"/api/archive/{archived_id}", headers=headers)
    assert r.status_code == 200

    state = client.get("/api/state", headers=headers).json()
    assert state["archive_count"] == 0


def test_delete_archive_unknown_404(client, headers):
    r = client.delete("/api/archive/9999", headers=headers)
    assert r.status_code == 404


def test_state_returns_ingest_when_active(client, headers):
    from bot.db.store import connect
    from bot.services import ingest_state

    async def seed():
        async with connect() as db:
            await ingest_state.start(db, 111, "voice", "Распознаю…", "0:08")
    asyncio.run(seed())

    state = client.get("/api/state", headers=headers).json()
    assert state["ingest"] is not None
    assert state["ingest"]["kind"] == "voice"
    assert state["ingest"]["stage"] == "transcribing"
    assert state["ingest"]["title"] == "Распознаю…"


def test_state_ingest_is_user_scoped(client, headers):
    from bot.db.store import connect
    from bot.services import ingest_state

    async def seed():
        async with connect() as db:
            await ingest_state.start(db, 222, "text", "Чужое", None)
    asyncio.run(seed())

    state = client.get("/api/state", headers=headers).json()
    assert state["ingest"] is None
