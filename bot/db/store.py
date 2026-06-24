from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

import aiosqlite

from bot.config import settings


SCHEMA_PATH = Path(__file__).parent / "schema.sql"


async def init_db(db_path: str | None = None) -> None:
    path = db_path or settings.DB_PATH
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    schema = SCHEMA_PATH.read_text(encoding="utf-8")
    async with aiosqlite.connect(path) as db:
        await db.executescript(schema)
        await _migrate(db)
        await db.commit()


# Default named-list catalogue, seeded once into an empty `named_lists` table.
# «Общее» is the default bucket; colours come from the design's LISTS palette.
# Future UI edits (rename/delete) are preserved — seeding only runs when the
# table is empty, so it never resurrects a list the user removed.
DEFAULT_NAMED_LISTS = (
    # key, name, color, position, is_default
    ("general", "Общее", "#30B0C7", 0, 1),
    ("tata", "Тата", "#FF4FA6", 1, 0),
    ("maksim", "Максим", "#AF52DE", 2, 0),
)


async def _migrate(db: aiosqlite.Connection) -> None:
    """Idempotent column migrations for DBs created before a column existed.

    `CREATE TABLE IF NOT EXISTS` never alters an existing table, so a new column
    must be added with a guarded ALTER. Safe to run on every startup.
    """
    item_cols = {row[1] for row in await (await db.execute("PRAGMA table_info(items)")).fetchall()}
    if "category" not in item_cols:
        await db.execute("ALTER TABLE items ADD COLUMN category TEXT")
    if "named_list_id" not in item_cols:
        await db.execute("ALTER TABLE items ADD COLUMN named_list_id INTEGER REFERENCES named_lists(id)")

    list_cols = {row[1] for row in await (await db.execute("PRAGMA table_info(lists)")).fetchall()}
    if "named_list_id" not in list_cols:
        await db.execute("ALTER TABLE lists ADD COLUMN named_list_id INTEGER REFERENCES named_lists(id)")

    # Index lives here (not in schema.sql) so it is created only after the
    # named_list_id column exists — legacy items tables predate it.
    await db.execute(
        "CREATE INDEX IF NOT EXISTS items_named_list_idx ON items(list_id, named_list_id)"
    )

    await _seed_named_lists(db)
    await _backfill_named_list(db)


async def _seed_named_lists(db: aiosqlite.Connection) -> None:
    """Seed the default catalogue only when `named_lists` is empty."""
    row = await (await db.execute("SELECT COUNT(*) AS n FROM named_lists")).fetchone()
    if (row[0] if row else 0) > 0:
        return
    await db.executemany(
        "INSERT OR IGNORE INTO named_lists (key, name, color, position, is_default) "
        "VALUES (?, ?, ?, ?, ?)",
        DEFAULT_NAMED_LISTS,
    )


async def _backfill_named_list(db: aiosqlite.Connection) -> None:
    """Tag pre-existing items and archived snapshots with the default list.

    Everything created before named lists existed belongs to «Общее».
    """
    default = await (await db.execute(
        "SELECT id FROM named_lists WHERE is_default=1 ORDER BY position LIMIT 1"
    )).fetchone()
    if not default:
        return
    default_id = default[0]
    await db.execute(
        "UPDATE items SET named_list_id=? WHERE named_list_id IS NULL", (default_id,)
    )
    await db.execute(
        "UPDATE lists SET named_list_id=? WHERE named_list_id IS NULL", (default_id,)
    )


@asynccontextmanager
async def connect(db_path: str | None = None) -> AsyncIterator[aiosqlite.Connection]:
    path = db_path or settings.DB_PATH
    async with aiosqlite.connect(path) as db:
        await db.execute("PRAGMA foreign_keys = ON")
        db.row_factory = aiosqlite.Row
        yield db
