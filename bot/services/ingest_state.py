"""Ingest progress tracking for the Mini App status banner.

The bot writes events here while processing text/voice/photo messages so the
Mini App can show «Распознаю / Извлекаю товары / Готово» without round-tripping
through the chat. Active events are anything still in flight (finished_at IS
NULL) plus successes within SUCCESS_TTL seconds (so the banner lingers briefly
after items appear).
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from typing import Optional

import aiosqlite

SUCCESS_TTL_SEC = 4
"""How long a 'success' event keeps showing in the banner after finishing."""


@dataclass
class IngestEvent:
    id: int
    user_id: int
    kind: str
    stage: str
    title: Optional[str]
    sub: Optional[str]
    added: list[dict]
    created_at: int
    updated_at: int
    finished_at: Optional[int]


def _initial_stage(kind: str) -> str:
    if kind == "voice":
        return "transcribing"
    if kind == "photo":
        return "parsing"
    return "parsing"


async def start(
    db: aiosqlite.Connection,
    user_id: int,
    kind: str,
    title: str,
    sub: Optional[str] = None,
) -> int:
    now = int(time.time())
    cursor = await db.execute(
        "INSERT INTO ingest_events (user_id, kind, stage, title, sub, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (user_id, kind, _initial_stage(kind), title, sub, now, now),
    )
    await db.commit()
    return cursor.lastrowid  # type: ignore[return-value]


async def update(
    db: aiosqlite.Connection,
    event_id: int,
    stage: str,
    title: Optional[str] = None,
    sub: Optional[str] = None,
) -> None:
    now = int(time.time())
    fields = ["stage=?", "updated_at=?"]
    params: list = [stage, now]
    if title is not None:
        fields.append("title=?")
        params.append(title)
    if sub is not None:
        fields.append("sub=?")
        params.append(sub)
    params.append(event_id)
    await db.execute(
        f"UPDATE ingest_events SET {', '.join(fields)} WHERE id=?", params
    )
    await db.commit()


async def finish_success(
    db: aiosqlite.Connection,
    event_id: int,
    added: list[dict],
    title: Optional[str] = None,
    sub: Optional[str] = None,
) -> None:
    now = int(time.time())
    await db.execute(
        "UPDATE ingest_events "
        "SET stage='success', title=COALESCE(?, title), sub=COALESCE(?, sub), "
        "added_json=?, updated_at=?, finished_at=? WHERE id=?",
        (title, sub, json.dumps(added, ensure_ascii=False), now, now, event_id),
    )
    await db.commit()


async def finish_error(
    db: aiosqlite.Connection,
    event_id: int,
    title: str = "Не удалось разобрать",
    sub: Optional[str] = None,
) -> None:
    now = int(time.time())
    await db.execute(
        "UPDATE ingest_events SET stage='error', title=?, sub=?, "
        "updated_at=?, finished_at=? WHERE id=?",
        (title, sub, now, now, event_id),
    )
    await db.commit()


async def get_active(
    db: aiosqlite.Connection, user_id: int
) -> Optional[IngestEvent]:
    """Return the most recent in-flight or just-finished event for the user."""
    now = int(time.time())
    row = await (await db.execute(
        "SELECT id, user_id, kind, stage, title, sub, added_json, "
        "created_at, updated_at, finished_at "
        "FROM ingest_events "
        "WHERE user_id=? AND ("
        "  finished_at IS NULL OR (stage='success' AND finished_at >= ?)"
        ") "
        "ORDER BY id DESC LIMIT 1",
        (user_id, now - SUCCESS_TTL_SEC),
    )).fetchone()
    if not row:
        return None
    added: list[dict] = []
    if row["added_json"]:
        try:
            added = json.loads(row["added_json"]) or []
        except (ValueError, TypeError):
            added = []
    return IngestEvent(
        id=row["id"],
        user_id=row["user_id"],
        kind=row["kind"],
        stage=row["stage"],
        title=row["title"],
        sub=row["sub"],
        added=added,
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        finished_at=row["finished_at"],
    )
