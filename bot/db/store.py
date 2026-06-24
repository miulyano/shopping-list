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


async def _migrate(db: aiosqlite.Connection) -> None:
    """Idempotent column migrations for DBs created before a column existed.

    `CREATE TABLE IF NOT EXISTS` never alters an existing table, so a new column
    must be added with a guarded ALTER. Safe to run on every startup.
    """
    cols = {row[1] for row in await (await db.execute("PRAGMA table_info(items)")).fetchall()}
    if "category" not in cols:
        await db.execute("ALTER TABLE items ADD COLUMN category TEXT")


@asynccontextmanager
async def connect(db_path: str | None = None) -> AsyncIterator[aiosqlite.Connection]:
    path = db_path or settings.DB_PATH
    async with aiosqlite.connect(path) as db:
        await db.execute("PRAGMA foreign_keys = ON")
        db.row_factory = aiosqlite.Row
        yield db
