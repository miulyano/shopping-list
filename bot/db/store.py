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
        await db.commit()


@asynccontextmanager
async def connect(db_path: str | None = None) -> AsyncIterator[aiosqlite.Connection]:
    path = db_path or settings.DB_PATH
    async with aiosqlite.connect(path) as db:
        await db.execute("PRAGMA foreign_keys = ON")
        db.row_factory = aiosqlite.Row
        yield db
