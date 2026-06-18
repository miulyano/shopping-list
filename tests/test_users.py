import pytest

from bot.db.users import get_users, upsert_user


@pytest.mark.asyncio
async def test_upsert_inserts_then_fetch(db):
    await upsert_user(db, 111, "Alice", "alice")
    got = await get_users(db, [111])
    assert got[111].first_name == "Alice"
    assert got[111].username == "alice"


@pytest.mark.asyncio
async def test_upsert_updates_and_bumps_updated_at(db, monkeypatch):
    monkeypatch.setattr("bot.db.users.time.time", lambda: 1000)
    await upsert_user(db, 111, "Alice", None)
    row1 = await (await db.execute(
        "SELECT updated_at FROM users WHERE user_id=111"
    )).fetchone()

    monkeypatch.setattr("bot.db.users.time.time", lambda: 2000)
    await upsert_user(db, 111, "Alicia", "alicia")
    row2 = await (await db.execute(
        "SELECT first_name, username, updated_at FROM users WHERE user_id=111"
    )).fetchone()

    assert row1["updated_at"] == 1000
    assert row2["first_name"] == "Alicia"
    assert row2["username"] == "alicia"
    assert row2["updated_at"] == 2000


@pytest.mark.asyncio
async def test_get_users_empty_returns_empty(db):
    assert await get_users(db, []) == {}


@pytest.mark.asyncio
async def test_get_users_mixed_known_unknown(db):
    await upsert_user(db, 111, "Alice", None)
    got = await get_users(db, [111, 999])
    assert set(got.keys()) == {111}
