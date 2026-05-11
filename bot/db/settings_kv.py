from __future__ import annotations

import aiosqlite


async def get_setting(db: aiosqlite.Connection, key: str) -> str | None:
    cursor = await db.execute("SELECT value FROM app_settings WHERE key = ?", (key,))
    row = await cursor.fetchone()
    return row[0] if row else None


async def set_setting(db: aiosqlite.Connection, key: str, value: str) -> None:
    await db.execute(
        "INSERT INTO app_settings(key, value) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, value),
    )
    await db.commit()


PINNED_THREAD_ID_KEY = "pinned_thread_id"
