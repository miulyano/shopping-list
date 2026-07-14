from __future__ import annotations

import re
import time
from typing import Iterable, Optional

import aiosqlite

from bot.db.models import Item, NamedList, ShoppingList
from bot.services.name_format import format_item_name
from bot.services.parser import ParsedItem


# ── named-list catalogue ────────────────────────────────────────────────────

def _row_to_named_list(row: aiosqlite.Row) -> NamedList:
    return NamedList(
        id=row["id"],
        key=row["key"],
        name=row["name"],
        color=row["color"],
        position=row["position"],
        is_default=bool(row["is_default"]),
    )


async def get_named_lists(db: aiosqlite.Connection) -> list[NamedList]:
    cur = await db.execute(
        "SELECT id, key, name, color, position, is_default FROM named_lists "
        "WHERE is_active=1 ORDER BY position, id"
    )
    return [_row_to_named_list(r) for r in await cur.fetchall()]


async def default_named_list(db: aiosqlite.Connection) -> Optional[NamedList]:
    row = await (await db.execute(
        "SELECT id, key, name, color, position, is_default FROM named_lists "
        "WHERE is_default=1 ORDER BY position, id LIMIT 1"
    )).fetchone()
    if row is None:
        row = await (await db.execute(
            "SELECT id, key, name, color, position, is_default FROM named_lists "
            "WHERE is_active=1 ORDER BY position, id LIMIT 1"
        )).fetchone()
    return _row_to_named_list(row) if row else None


async def get_named_list(
    db: aiosqlite.Connection, named_list_id: int
) -> Optional[NamedList]:
    row = await (await db.execute(
        "SELECT id, key, name, color, position, is_default FROM named_lists WHERE id=?",
        (named_list_id,),
    )).fetchone()
    return _row_to_named_list(row) if row else None


def _norm(s: str) -> str:
    """Lowercase, keep letters only — for tolerant list-name matching."""
    return "".join(ch for ch in s.strip().casefold() if ch.isalpha())


def _hint_matches(hint: str, candidate: str) -> bool:
    """Tolerant match of a parsed addressee `hint` against a list name/key.

    Handles Russian declensions by comparing the common prefix: «Тате»/«Тату»
    match «Тата», «Максиму»/«Максимке» match «Максим». Deliberately fuzzy but
    anchored at >=3 shared leading letters to avoid cross-list collisions.
    """
    h, c = _norm(hint), _norm(candidate)
    if not h or not c:
        return False
    if h == c:
        return True
    n = 0
    while n < len(h) and n < len(c) and h[n] == c[n]:
        n += 1
    return n >= 3 and n >= min(len(h), len(c)) - 2


async def match_named_list(
    db: aiosqlite.Connection, hint: Optional[str]
) -> Optional[NamedList]:
    """Resolve a parsed list `hint` to a catalogue entry, or None if no match."""
    if not hint or not hint.strip():
        return None
    lists = await get_named_lists(db)
    for nl in lists:
        if _hint_matches(hint, nl.name) or _hint_matches(hint, nl.key):
            return nl
    return None


async def match_named_list_in_text(
    db: aiosqlite.Connection, text: Optional[str]
) -> Optional[NamedList]:
    """Scan free text token-by-token for a list-name mention (e.g. a photo caption)."""
    if not text or not text.strip():
        return None
    lists = await get_named_lists(db)
    for token in re.findall(r"\w+", text, re.UNICODE):
        for nl in lists:
            if _hint_matches(token, nl.name) or _hint_matches(token, nl.key):
                return nl
    return None


async def resolve_target_list(
    db: aiosqlite.Connection, hint: Optional[str]
) -> tuple[Optional[NamedList], bool, bool]:
    """Resolve a parsed `hint` to a target list for adding items.

    Returns (target_list, mentioned, unresolved):
    - mentioned  — the message named a list/addressee at all;
    - unresolved — a list was mentioned but matched nothing (→ default «Общее»).
    Target falls back to the default list when nothing matched.
    """
    mentioned = bool(hint and hint.strip())
    target = await match_named_list(db, hint)
    if target is not None:
        return target, mentioned, False
    return await default_named_list(db), mentioned, mentioned


async def move_item(
    db: aiosqlite.Connection, item_id: int, named_list_id: int
) -> Optional[tuple[int, list[int]]]:
    """Reassign an item to another named list.

    Returns (list_id, archived_named_list_ids) or None if the item is not found
    in the active list — items already living in an archived snapshot are left
    untouched (re-archiving them would fragment the snapshot).
    Moving can complete a bucket without a check, so auto-archive is re-run for
    both the target (item just arrived) and the source (item just left) buckets;
    each can archive independently (e.g. a stuck all-bought source drained by
    the move), so `archived_named_list_ids` may hold zero, one or two entries.
    """
    row = await (await db.execute(
        "SELECT i.list_id, i.named_list_id FROM items i "
        "JOIN lists l ON l.id = i.list_id "
        "WHERE i.id=? AND l.status='active'",
        (item_id,),
    )).fetchone()
    if not row:
        return None
    list_id = row["list_id"]
    source_named_list_id = row["named_list_id"]
    await db.execute(
        "UPDATE items SET named_list_id=? WHERE id=?", (named_list_id, item_id)
    )
    archived: list[int] = []
    target_archived = await archive_if_all_done(db, list_id, named_list_id)
    if target_archived is not None:
        archived.append(target_archived)
    if source_named_list_id != named_list_id:
        source_archived = await archive_if_all_done(db, list_id, source_named_list_id)
        if source_archived is not None:
            archived.append(source_archived)
    await db.commit()
    return list_id, archived


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
    named_list_id: Optional[int] = None,
) -> tuple[int, list[str]]:
    """Insert items into active list (creating it if needed). Returns (list_id, names).

    `named_list_id` tags every inserted item with the target named list; falls
    back to the default list («Общее») when not given.
    """
    list_id = await ensure_active_list(db)
    if named_list_id is None:
        default = await default_named_list(db)
        named_list_id = default.id if default else None
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
            "INSERT INTO items (list_id, name, qty, done, added_by, added_at, position, category, named_list_id) "
            "VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)",
            (list_id, name, it.qty, user_id, now, pos, it.category, named_list_id),
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
) -> Optional[tuple[int, bool, Optional[int]]]:
    """Set done flag to an explicit value. Idempotent — repeating the same call
    is a no-op, concurrent calls converge to the latest committed value.

    Returns (list_id, done, archived_named_list_id) or None if item not found.
    `archived_named_list_id` is the named list that was just archived (all its
    items bought), or None if nothing archived.
    """
    row = await (await db.execute(
        "SELECT list_id, named_list_id FROM items WHERE id=?", (item_id,)
    )).fetchone()
    if not row:
        return None
    new_done = 1 if done else 0
    now = int(time.time())
    await db.execute(
        "UPDATE items SET done=?, checked_by=?, checked_at=? WHERE id=?",
        (new_done, user_id if new_done else None, now if new_done else None, item_id),
    )
    archived_named_list_id: Optional[int] = None
    if new_done:
        archived_named_list_id = await archive_if_all_done(
            db, row["list_id"], row["named_list_id"]
        )
    await db.commit()
    return row["list_id"], bool(new_done), archived_named_list_id


async def archive_if_all_done(
    db: aiosqlite.Connection,
    list_id: int,
    named_list_id: Optional[int],
) -> Optional[int]:
    """Archive a single named list once all its active items are bought.

    Counts done/total within (active list_id, named_list_id). When the whole
    bucket is bought, its items move into a fresh archived snapshot tagged with
    that named list; items of other buckets stay in the active session.
    Returns the archived named_list_id, or None if nothing was archived.
    """
    row = await (await db.execute(
        "SELECT COUNT(*) AS total, SUM(done) AS done FROM items "
        "WHERE list_id=? AND named_list_id IS ?",
        (list_id, named_list_id),
    )).fetchone()
    total = row["total"] or 0
    done = row["done"] or 0
    if total == 0 or done != total:
        return None
    now = int(time.time())
    cursor = await db.execute(
        "INSERT INTO lists (status, created_at, archived_at, named_list_id) "
        "VALUES ('archived', ?, ?, ?)",
        (now, now, named_list_id),
    )
    archive_id = cursor.lastrowid
    await db.execute(
        "UPDATE items SET list_id=? WHERE list_id=? AND named_list_id IS ?",
        (archive_id, list_id, named_list_id),
    )
    return named_list_id


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
        named_list_id=row["named_list_id"],
    )


async def _load_list_with_items(
    db: aiosqlite.Connection, list_row: aiosqlite.Row
) -> ShoppingList:
    items_cur = await db.execute(
        "SELECT id, list_id, name, qty, done, added_by, added_at, checked_by, checked_at, position, category, named_list_id "
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
        named_list_id=list_row["named_list_id"],
    )


async def get_state(db: aiosqlite.Connection) -> Optional[ShoppingList]:
    row = await (await db.execute(
        "SELECT id, status, created_at, archived_at, named_list_id FROM lists WHERE status='active' ORDER BY id DESC LIMIT 1"
    )).fetchone()
    if not row:
        return None
    return await _load_list_with_items(db, row)


async def get_archive(db: aiosqlite.Connection, limit: int = 50) -> list[ShoppingList]:
    cur = await db.execute(
        "SELECT id, status, created_at, archived_at, named_list_id FROM lists WHERE status='archived' "
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


async def delete_item(
    db: aiosqlite.Connection, item_id: int
) -> Optional[tuple[int, Optional[int]]]:
    """Delete an item.

    Returns (list_id, archived_named_list_id) or None if the item is not found
    in the active list — items already living in an archived snapshot are left
    untouched (re-archiving them would fragment the snapshot).
    Removing an unbought item can leave its bucket fully bought, so auto-archive
    is re-run for that bucket; `archived_named_list_id` is the bucket that got
    archived, or None.
    """
    row = await (await db.execute(
        "SELECT i.list_id, i.named_list_id FROM items i "
        "JOIN lists l ON l.id = i.list_id "
        "WHERE i.id=? AND l.status='active'",
        (item_id,),
    )).fetchone()
    if not row:
        return None
    list_id = row["list_id"]
    await db.execute("DELETE FROM items WHERE id=?", (item_id,))
    archived = await archive_if_all_done(db, list_id, row["named_list_id"])
    await db.commit()
    return list_id, archived


async def get_archive_list(
    db: aiosqlite.Connection,
    list_id: int,
) -> Optional[ShoppingList]:
    row = await (await db.execute(
        "SELECT id, status, created_at, archived_at, named_list_id FROM lists "
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
    named_list_id: Optional[int] = None,
) -> Optional[tuple[int, int]]:
    """Move purchased (done=1) items of one named list out of the active list
    into a new archived snapshot tagged with that named list.

    Returns (archived_list_id, moved_count) or None if active list not found
    or there are no purchased items to move. When `named_list_id` is None,
    operates over the whole active list (legacy behaviour).
    """
    row = await (await db.execute(
        "SELECT id FROM lists WHERE id=? AND status='active'", (list_id,)
    )).fetchone()
    if not row:
        return None

    if named_list_id is None:
        count_row = await (await db.execute(
            "SELECT COUNT(*) AS n FROM items WHERE list_id=? AND done=1", (list_id,)
        )).fetchone()
    else:
        count_row = await (await db.execute(
            "SELECT COUNT(*) AS n FROM items WHERE list_id=? AND done=1 AND named_list_id IS ?",
            (list_id, named_list_id),
        )).fetchone()
    moved = count_row["n"] or 0
    if moved == 0:
        return None

    now = int(time.time())
    cursor = await db.execute(
        "INSERT INTO lists (status, created_at, archived_at, named_list_id) "
        "VALUES ('archived', ?, ?, ?)",
        (now, now, named_list_id),
    )
    new_archive_id = cursor.lastrowid

    if named_list_id is None:
        await db.execute(
            "UPDATE items SET list_id=? WHERE list_id=? AND done=1",
            (new_archive_id, list_id),
        )
    else:
        await db.execute(
            "UPDATE items SET list_id=? WHERE list_id=? AND done=1 AND named_list_id IS ?",
            (new_archive_id, list_id, named_list_id),
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
    named_list_id: Optional[int] = None,
    item_ids: Optional[list[int]] = None,
) -> Optional[tuple[int, int]]:
    """Copy items from archived list into active list (creating it if needed).

    ``item_ids`` — copy only this subset of the snapshot's items (all when None).
    ``named_list_id`` — put every copied item into this named list (overrides the
    per-item restore logic when given).

    Returns (active_list_id, added_count) or None if src archive not found.
    """
    src = await get_archive_list(db, src_list_id)
    if src is None:
        return None
    items = src.items
    if item_ids is not None:
        wanted = set(item_ids)
        items = [it for it in items if it.id in wanted]
    list_id = await ensure_active_list(db)
    row = await (await db.execute(
        "SELECT COALESCE(MAX(position), 0) AS p FROM items WHERE list_id=?", (list_id,)
    )).fetchone()
    pos = (row["p"] or 0) + 1
    now = int(time.time())
    default = await default_named_list(db)
    default_id = default.id if default else None
    added = 0
    for it in items:
        # Honour an explicit destination; otherwise restore each item to its
        # native named list, falling back to the snapshot's tag, then default.
        nl_id = named_list_id or it.named_list_id or src.named_list_id or default_id
        await db.execute(
            "INSERT INTO items (list_id, name, qty, done, added_by, added_at, position, category, named_list_id) "
            "VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)",
            (list_id, it.name, it.qty, user_id, now, pos, it.category, nl_id),
        )
        added += 1
        pos += 1
    await db.commit()
    return list_id, added
