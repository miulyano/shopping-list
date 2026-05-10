from __future__ import annotations

import time
from typing import Iterable, Optional

import aiosqlite

from bot.db.models import Item, ShoppingList
from bot.services.parser import ParsedItem


async def get_active_list_id(db: aiosqlite.Connection) -> Optional[int]:
    row = await (await db.execute(
        "SELECT id FROM lists WHERE status='active' ORDER BY id DESC LIMIT 1"
    )).fetchone()
    return row["id"] if row else None


async def ensure_active_list(db: aiosqlite.Connection) -> int:
    list_id = await get_active_list_id(db)
    if list_id is not None:
        return list_id
    cursor = await db.execute(
        "INSERT INTO lists (status, created_at) VALUES ('active', ?)",
        (int(time.time()),),
    )
    await db.commit()
    return cursor.lastrowid  # type: ignore[return-value]


async def add_items(
    db: aiosqlite.Connection,
    items: Iterable[ParsedItem],
    user_id: int,
) -> tuple[int, list[str]]:
    """Insert items into active list (creating it if needed). Returns (list_id, names)."""
    list_id = await ensure_active_list(db)
    row = await (await db.execute(
        "SELECT COALESCE(MAX(position), 0) AS p FROM items WHERE list_id=?", (list_id,)
    )).fetchone()
    pos = (row["p"] or 0) + 1
    now = int(time.time())
    inserted: list[str] = []
    for it in items:
        name = it.name.strip()
        if not name:
            continue
        await db.execute(
            "INSERT INTO items (list_id, name, qty, done, added_by, added_at, position) "
            "VALUES (?, ?, ?, 0, ?, ?, ?)",
            (list_id, name, it.qty, user_id, now, pos),
        )
        inserted.append(name)
        pos += 1
    await db.commit()
    return list_id, inserted


async def toggle_item(
    db: aiosqlite.Connection,
    item_id: int,
    user_id: int,
) -> Optional[tuple[int, bool, bool]]:
    """Toggle done flag. Returns (list_id, new_done, archived) or None if item not found."""
    row = await (await db.execute(
        "SELECT id, list_id, done FROM items WHERE id=?", (item_id,)
    )).fetchone()
    if not row:
        return None
    new_done = 0 if row["done"] else 1
    now = int(time.time())
    await db.execute(
        "UPDATE items SET done=?, checked_by=?, checked_at=? WHERE id=?",
        (new_done, user_id if new_done else None, now if new_done else None, item_id),
    )
    archived = False
    if new_done:
        archived = await archive_if_all_done(db, row["list_id"])
    await db.commit()
    return row["list_id"], bool(new_done), archived


async def archive_if_all_done(db: aiosqlite.Connection, list_id: int) -> bool:
    row = await (await db.execute(
        "SELECT COUNT(*) AS total, SUM(done) AS done FROM items WHERE list_id=?",
        (list_id,),
    )).fetchone()
    total = row["total"] or 0
    done = row["done"] or 0
    if total > 0 and done == total:
        await db.execute(
            "UPDATE lists SET status='archived', archived_at=? WHERE id=? AND status='active'",
            (int(time.time()), list_id),
        )
        return True
    return False


async def archive_active_list(db: aiosqlite.Connection, list_id: int) -> None:
    await db.execute(
        "UPDATE lists SET status='archived', archived_at=? WHERE id=? AND status='active'",
        (int(time.time()), list_id),
    )
    await db.commit()


def _row_to_item(row: aiosqlite.Row) -> Item:
    return Item(
        id=row["id"],
        list_id=row["list_id"],
        name=row["name"],
        qty=row["qty"],
        done=bool(row["done"]),
        added_by=row["added_by"],
        added_at=row["added_at"],
        checked_by=row["checked_by"],
        checked_at=row["checked_at"],
        position=row["position"],
    )


async def get_state(db: aiosqlite.Connection) -> Optional[ShoppingList]:
    row = await (await db.execute(
        "SELECT id, status, created_at, archived_at FROM lists WHERE status='active' ORDER BY id DESC LIMIT 1"
    )).fetchone()
    if not row:
        return None
    items_cur = await db.execute(
        "SELECT id, list_id, name, qty, done, added_by, added_at, checked_by, checked_at, position "
        "FROM items WHERE list_id=? ORDER BY position",
        (row["id"],),
    )
    items = [_row_to_item(r) for r in await items_cur.fetchall()]
    return ShoppingList(
        id=row["id"],
        status=row["status"],
        created_at=row["created_at"],
        archived_at=row["archived_at"],
        items=items,
    )


async def get_archive(db: aiosqlite.Connection, limit: int = 50) -> list[ShoppingList]:
    cur = await db.execute(
        "SELECT id, status, created_at, archived_at FROM lists WHERE status='archived' "
        "ORDER BY archived_at DESC LIMIT ?",
        (limit,),
    )
    lists_rows = await cur.fetchall()
    out: list[ShoppingList] = []
    for lr in lists_rows:
        items_cur = await db.execute(
            "SELECT id, list_id, name, qty, done, added_by, added_at, checked_by, checked_at, position "
            "FROM items WHERE list_id=? ORDER BY position",
            (lr["id"],),
        )
        items = [_row_to_item(r) for r in await items_cur.fetchall()]
        out.append(ShoppingList(
            id=lr["id"], status=lr["status"], created_at=lr["created_at"],
            archived_at=lr["archived_at"], items=items,
        ))
    return out


async def archive_count(db: aiosqlite.Connection) -> int:
    row = await (await db.execute(
        "SELECT COUNT(*) AS n FROM lists WHERE status='archived'"
    )).fetchone()
    return row["n"] or 0
