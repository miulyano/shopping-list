from __future__ import annotations

import time
from typing import Iterable, Optional

import aiosqlite

from bot.db.models import Item, ShoppingList
from bot.services.name_format import format_item_name
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
        name = format_item_name(it.name, it.brands)
        if not name:
            continue
        await db.execute(
            "INSERT INTO items (list_id, name, qty, done, added_by, added_at, position, category) "
            "VALUES (?, ?, ?, 0, ?, ?, ?, ?)",
            (list_id, name, it.qty, user_id, now, pos, it.category),
        )
        inserted.append(name)
        pos += 1
    await db.commit()
    return list_id, inserted


async def set_item_done(
    db: aiosqlite.Connection,
    item_id: int,
    user_id: int,
    done: bool,
) -> Optional[tuple[int, bool, bool]]:
    """Set done flag to an explicit value. Idempotent — repeating the same call
    is a no-op, concurrent calls converge to the latest committed value.

    Returns (list_id, done, archived) or None if item not found.
    """
    row = await (await db.execute(
        "SELECT list_id FROM items WHERE id=?", (item_id,)
    )).fetchone()
    if not row:
        return None
    new_done = 1 if done else 0
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
        category=row["category"],
    )


async def _load_list_with_items(
    db: aiosqlite.Connection, list_row: aiosqlite.Row
) -> ShoppingList:
    items_cur = await db.execute(
        "SELECT id, list_id, name, qty, done, added_by, added_at, checked_by, checked_at, position, category "
        "FROM items WHERE list_id=? ORDER BY done ASC, checked_at ASC, position ASC",
        (list_row["id"],),
    )
    items = [_row_to_item(r) for r in await items_cur.fetchall()]
    return ShoppingList(
        id=list_row["id"],
        status=list_row["status"],
        created_at=list_row["created_at"],
        archived_at=list_row["archived_at"],
        items=items,
    )


async def get_state(db: aiosqlite.Connection) -> Optional[ShoppingList]:
    row = await (await db.execute(
        "SELECT id, status, created_at, archived_at FROM lists WHERE status='active' ORDER BY id DESC LIMIT 1"
    )).fetchone()
    if not row:
        return None
    return await _load_list_with_items(db, row)


async def get_archive(db: aiosqlite.Connection, limit: int = 50) -> list[ShoppingList]:
    cur = await db.execute(
        "SELECT id, status, created_at, archived_at FROM lists WHERE status='archived' "
        "ORDER BY archived_at DESC LIMIT ?",
        (limit,),
    )
    lists_rows = await cur.fetchall()
    return [await _load_list_with_items(db, lr) for lr in lists_rows]


async def archive_count(db: aiosqlite.Connection) -> int:
    row = await (await db.execute(
        "SELECT COUNT(*) AS n FROM lists WHERE status='archived'"
    )).fetchone()
    return row["n"] or 0


async def update_item(
    db: aiosqlite.Connection,
    item_id: int,
    name: str,
    qty: Optional[str],
    category: Optional[str] = None,
) -> Optional[int]:
    """Update item name/qty (and category when given). Returns list_id or None."""
    row = await (await db.execute(
        "SELECT list_id FROM items WHERE id=?", (item_id,)
    )).fetchone()
    if not row:
        return None
    if category is not None:
        await db.execute(
            "UPDATE items SET name=?, qty=?, category=? WHERE id=?",
            (name.strip(), qty.strip() if qty else None, category, item_id),
        )
    else:
        await db.execute(
            "UPDATE items SET name=?, qty=? WHERE id=?",
            (name.strip(), qty.strip() if qty else None, item_id),
        )
    await db.commit()
    return row["list_id"]


async def delete_item(db: aiosqlite.Connection, item_id: int) -> Optional[int]:
    """Delete item. Returns list_id or None if item not found."""
    row = await (await db.execute(
        "SELECT list_id FROM items WHERE id=?", (item_id,)
    )).fetchone()
    if not row:
        return None
    await db.execute("DELETE FROM items WHERE id=?", (item_id,))
    await db.commit()
    return row["list_id"]


async def get_archive_list(
    db: aiosqlite.Connection,
    list_id: int,
) -> Optional[ShoppingList]:
    row = await (await db.execute(
        "SELECT id, status, created_at, archived_at FROM lists "
        "WHERE id=? AND status='archived'",
        (list_id,),
    )).fetchone()
    if not row:
        return None
    return await _load_list_with_items(db, row)


async def delete_archive_list(db: aiosqlite.Connection, list_id: int) -> bool:
    """Delete archived list and its items. Returns True if deleted."""
    row = await (await db.execute(
        "SELECT id FROM lists WHERE id=? AND status='archived'", (list_id,)
    )).fetchone()
    if not row:
        return False
    await db.execute("DELETE FROM items WHERE list_id=?", (list_id,))
    await db.execute("DELETE FROM lists WHERE id=?", (list_id,))
    await db.commit()
    return True


async def archive_purchased(
    db: aiosqlite.Connection,
    list_id: int,
) -> Optional[tuple[int, int]]:
    """Move purchased (done=1) items out of active list into a new archived list.

    Returns (archived_list_id, moved_count) or None if active list not found
    or there are no purchased items to move.
    """
    row = await (await db.execute(
        "SELECT id FROM lists WHERE id=? AND status='active'", (list_id,)
    )).fetchone()
    if not row:
        return None

    count_row = await (await db.execute(
        "SELECT COUNT(*) AS n FROM items WHERE list_id=? AND done=1", (list_id,)
    )).fetchone()
    moved = count_row["n"] or 0
    if moved == 0:
        return None

    now = int(time.time())
    cursor = await db.execute(
        "INSERT INTO lists (status, created_at, archived_at) VALUES ('archived', ?, ?)",
        (now, now),
    )
    new_archive_id = cursor.lastrowid

    await db.execute(
        "UPDATE items SET list_id=? WHERE list_id=? AND done=1",
        (new_archive_id, list_id),
    )

    remaining = await (await db.execute(
        "SELECT id FROM items WHERE list_id=? ORDER BY position ASC", (list_id,)
    )).fetchall()
    for i, r in enumerate(remaining, start=1):
        await db.execute("UPDATE items SET position=? WHERE id=?", (i, r["id"]))

    await db.commit()
    return new_archive_id, moved


async def reuse_archive_list(
    db: aiosqlite.Connection,
    src_list_id: int,
    user_id: int,
) -> Optional[tuple[int, int]]:
    """Copy items from archived list into active list (creating it if needed).

    Returns (active_list_id, added_count) or None if src archive not found.
    """
    src = await get_archive_list(db, src_list_id)
    if src is None:
        return None
    list_id = await ensure_active_list(db)
    row = await (await db.execute(
        "SELECT COALESCE(MAX(position), 0) AS p FROM items WHERE list_id=?", (list_id,)
    )).fetchone()
    pos = (row["p"] or 0) + 1
    now = int(time.time())
    added = 0
    for it in src.items:
        await db.execute(
            "INSERT INTO items (list_id, name, qty, done, added_by, added_at, position, category) "
            "VALUES (?, ?, ?, 0, ?, ?, ?, ?)",
            (list_id, it.name, it.qty, user_id, now, pos, it.category),
        )
        added += 1
        pos += 1
    await db.commit()
    return list_id, added
