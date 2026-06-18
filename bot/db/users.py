from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Optional

import aiosqlite


@dataclass
class UserName:
    user_id: int
    first_name: Optional[str]
    username: Optional[str]


async def upsert_user(
    db: aiosqlite.Connection,
    user_id: int,
    first_name: Optional[str],
    username: Optional[str],
) -> None:
    """Insert or refresh a user's display info. Called on every message."""
    await db.execute(
        "INSERT INTO users (user_id, first_name, username, updated_at) "
        "VALUES (?, ?, ?, ?) "
        "ON CONFLICT(user_id) DO UPDATE SET "
        "first_name=excluded.first_name, username=excluded.username, "
        "updated_at=excluded.updated_at",
        (user_id, first_name, username, int(time.time())),
    )
    await db.commit()


async def get_users(
    db: aiosqlite.Connection,
    user_ids: list[int],
) -> dict[int, UserName]:
    """Batch fetch known names for the given ids. Missing ids are simply absent."""
    if not user_ids:
        return {}
    placeholders = ",".join("?" for _ in user_ids)
    cur = await db.execute(
        f"SELECT user_id, first_name, username FROM users WHERE user_id IN ({placeholders})",
        tuple(user_ids),
    )
    rows = await cur.fetchall()
    return {
        r["user_id"]: UserName(r["user_id"], r["first_name"], r["username"])
        for r in rows
    }
