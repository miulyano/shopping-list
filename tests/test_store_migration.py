import aiosqlite
import pytest

from bot.db.store import init_db


async def _columns(path: str) -> set[str]:
    async with aiosqlite.connect(path) as db:
        rows = await (await db.execute("PRAGMA table_info(items)")).fetchall()
    return {r[1] for r in rows}


@pytest.mark.asyncio
async def test_init_db_adds_category_to_legacy_items_table(tmp_path):
    """A DB whose items table predates the category column gets it via ALTER,
    and re-running init_db is a no-op (idempotent)."""
    db_file = str(tmp_path / "legacy.db")
    # Simulate an old DB: items table without the category column.
    async with aiosqlite.connect(db_file) as db:
        await db.execute(
            "CREATE TABLE items (id INTEGER PRIMARY KEY, list_id INTEGER NOT NULL, "
            "name TEXT NOT NULL, qty TEXT, done INTEGER NOT NULL DEFAULT 0, "
            "added_by INTEGER NOT NULL, added_at INTEGER NOT NULL, "
            "checked_by INTEGER, checked_at INTEGER, position INTEGER NOT NULL)"
        )
        await db.execute(
            "INSERT INTO items (id, list_id, name, qty, done, added_by, added_at, position) "
            "VALUES (1, 1, 'молоко', NULL, 0, 111, 0, 1)"
        )
        await db.commit()

    assert "category" not in await _columns(db_file)

    await init_db(db_file)
    cols = await _columns(db_file)
    assert "category" in cols

    # Legacy row survives with NULL category.
    async with aiosqlite.connect(db_file) as db:
        row = await (await db.execute("SELECT category FROM items WHERE id=1")).fetchone()
    assert row[0] is None

    # Idempotent: second run does not raise / duplicate the column.
    await init_db(db_file)
    assert {c for c in await _columns(db_file) if c == "category"} == {"category"}
