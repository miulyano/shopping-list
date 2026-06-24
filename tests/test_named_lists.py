import aiosqlite
import pytest

from bot.services.parser import ParsedItem
from bot.services.shopping import (
    add_items,
    archive_purchased,
    default_named_list,
    get_archive,
    get_named_lists,
    get_state,
    match_named_list,
    match_named_list_in_text,
    move_item,
    resolve_target_list,
    reuse_archive_list,
    set_item_done,
)


# ── catalogue & seeding ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_catalogue_seeded_with_default(db):
    lists = await get_named_lists(db)
    keys = [nl.key for nl in lists]
    assert keys == ["general", "tata", "maksim"]
    default = await default_named_list(db)
    assert default is not None and default.key == "general"
    assert default.is_default is True


# ── hint matching (declensions) ─────────────────────────────────────────────

@pytest.mark.asyncio
@pytest.mark.parametrize("hint,expected", [
    ("Тата", "tata"),
    ("Тате", "tata"),
    ("Тату", "tata"),
    ("Максим", "maksim"),
    ("Максиму", "maksim"),
    ("Максимке", "maksim"),
    ("общее", "general"),
    ("общий", "general"),
    ("tata", "tata"),
])
async def test_match_named_list_declensions(db, hint, expected):
    nl = await match_named_list(db, hint)
    assert nl is not None and nl.key == expected


@pytest.mark.asyncio
@pytest.mark.parametrize("hint", ["Петя", "кому-то", "", None])
async def test_match_named_list_no_match(db, hint):
    assert await match_named_list(db, hint) is None


@pytest.mark.asyncio
async def test_match_named_list_in_text_caption(db):
    nl = await match_named_list_in_text(db, "для Таты по списку, чек на фото")
    assert nl is not None and nl.key == "tata"
    assert await match_named_list_in_text(db, "просто чек без адресата") is None


# ── resolve_target_list (the three cases) ───────────────────────────────────

@pytest.mark.asyncio
async def test_resolve_not_mentioned_goes_default(db):
    target, mentioned, unresolved = await resolve_target_list(db, None)
    assert target.key == "general"
    assert mentioned is False and unresolved is False


@pytest.mark.asyncio
async def test_resolve_matched(db):
    target, mentioned, unresolved = await resolve_target_list(db, "Максиму")
    assert target.key == "maksim"
    assert mentioned is True and unresolved is False


@pytest.mark.asyncio
async def test_resolve_mentioned_but_unresolved_goes_default(db):
    target, mentioned, unresolved = await resolve_target_list(db, "Васе")
    assert target.key == "general"
    assert mentioned is True and unresolved is True


# ── add_items tags the named list ───────────────────────────────────────────

async def _named_list_id(db: aiosqlite.Connection, key: str) -> int:
    row = await (await db.execute("SELECT id FROM named_lists WHERE key=?", (key,))).fetchone()
    return row["id"]


@pytest.mark.asyncio
async def test_add_items_tags_named_list(db):
    tata = await _named_list_id(db, "tata")
    await add_items(db, [ParsedItem("Сыр")], user_id=111, named_list_id=tata)
    state = await get_state(db)
    assert state.items[0].named_list_id == tata


@pytest.mark.asyncio
async def test_add_items_defaults_to_general(db):
    general = await _named_list_id(db, "general")
    await add_items(db, [ParsedItem("Молоко")], user_id=111)
    state = await get_state(db)
    assert state.items[0].named_list_id == general


# ── move_item ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_move_item_changes_list(db):
    general = await _named_list_id(db, "general")
    maksim = await _named_list_id(db, "maksim")
    await add_items(db, [ParsedItem("Хлеб")], user_id=111, named_list_id=general)
    item_id = (await get_state(db)).items[0].id
    assert await move_item(db, item_id, maksim) is not None
    assert (await get_state(db)).items[0].named_list_id == maksim


@pytest.mark.asyncio
async def test_move_item_does_not_autoarchive(db):
    """Moving the last item into a fully-bought list must not archive it."""
    tata = await _named_list_id(db, "tata")
    maksim = await _named_list_id(db, "maksim")
    # tata has one bought item; another bought item lives in maksim
    await add_items(db, [ParsedItem("A")], user_id=111, named_list_id=tata)
    await add_items(db, [ParsedItem("B")], user_id=111, named_list_id=maksim)
    state = await get_state(db)
    for it in state.items:
        await set_item_done(db, it.id, user_id=111, done=True)
    # Both single-item lists auto-archived on their last check; re-add fresh
    await add_items(db, [ParsedItem("C")], user_id=111, named_list_id=tata)
    item_c = (await get_state(db)).items[0].id
    await set_item_done(db, item_c, user_id=111, done=True)  # tata now archived again
    before = len(await get_archive(db))
    # Adding a done item via move shouldn't trigger another archive
    await add_items(db, [ParsedItem("D")], user_id=111, named_list_id=maksim)
    item_d = (await get_state(db)).items[0].id
    await move_item(db, item_d, tata)
    assert len(await get_archive(db)) == before


# ── per-list archiving isolation ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_archive_isolates_lists(db):
    general = await _named_list_id(db, "general")
    tata = await _named_list_id(db, "tata")
    await add_items(db, [ParsedItem("G")], user_id=111, named_list_id=general)
    await add_items(db, [ParsedItem("T1"), ParsedItem("T2")], user_id=111, named_list_id=tata)
    state = await get_state(db)
    tata_items = [it for it in state.items if it.named_list_id == tata]
    # buy all of tata
    for it in tata_items:
        archived = (await set_item_done(db, it.id, user_id=111, done=True))[2]
    assert archived == tata  # last check archived the tata list
    # general item stays active; tata snapshot is tagged with tata
    state2 = await get_state(db)
    assert [it.named_list_id for it in state2.items] == [general]
    archive = await get_archive(db)
    assert len(archive) == 1 and archive[0].named_list_id == tata
    assert {i.name for i in archive[0].items} == {"t1", "t2"}


@pytest.mark.asyncio
async def test_archive_purchased_by_list(db):
    general = await _named_list_id(db, "general")
    tata = await _named_list_id(db, "tata")
    await add_items(db, [ParsedItem("G1"), ParsedItem("G2")], user_id=111, named_list_id=general)
    await add_items(db, [ParsedItem("T1")], user_id=111, named_list_id=tata)
    state = await get_state(db)
    # buy one general item and the tata item
    g1 = next(it for it in state.items if it.name == "g1")
    t1 = next(it for it in state.items if it.name == "t1")
    await set_item_done(db, g1.id, user_id=111, done=True)
    await set_item_done(db, t1.id, user_id=111, done=True)
    # archive purchased of the general list only
    result = await archive_purchased(db, state.id, general)
    assert result is not None
    archive_id, moved = result
    assert moved == 1  # only g1, not the remaining (unbought) general item
    snapshot = next(a for a in await get_archive(db) if a.id == archive_id)
    assert snapshot.named_list_id == general
    assert {i.name for i in snapshot.items} == {"g1"}
    # g2 (general, unbought) stays in the active list
    assert {i.name for i in (await get_state(db)).items} == {"g2"}


# ── reuse restores native list ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_reuse_restores_native_named_list(db):
    maksim = await _named_list_id(db, "maksim")
    await add_items(db, [ParsedItem("Рис")], user_id=111, named_list_id=maksim)
    item_id = (await get_state(db)).items[0].id
    await set_item_done(db, item_id, user_id=111, done=True)  # archives maksim
    archived_id = (await get_archive(db))[0].id
    await reuse_archive_list(db, archived_id, user_id=222)
    restored = (await get_state(db)).items
    assert restored and all(it.named_list_id == maksim for it in restored)


# ── backfill of legacy rows ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_backfill_tags_legacy_items_to_default(tmp_path):
    from bot.db.store import connect, init_db

    db_file = str(tmp_path / "legacy.db")
    async with aiosqlite.connect(db_file) as raw:
        await raw.execute(
            "CREATE TABLE lists (id INTEGER PRIMARY KEY AUTOINCREMENT, "
            "status TEXT NOT NULL, created_at INTEGER NOT NULL, archived_at INTEGER)"
        )
        await raw.execute(
            "CREATE TABLE items (id INTEGER PRIMARY KEY, list_id INTEGER NOT NULL, "
            "name TEXT NOT NULL, qty TEXT, done INTEGER NOT NULL DEFAULT 0, "
            "added_by INTEGER NOT NULL, added_at INTEGER NOT NULL, "
            "checked_by INTEGER, checked_at INTEGER, position INTEGER NOT NULL)"
        )
        await raw.execute("INSERT INTO lists (status, created_at) VALUES ('active', 0)")
        await raw.execute(
            "INSERT INTO items (id, list_id, name, qty, done, added_by, added_at, position) "
            "VALUES (1, 1, 'молоко', NULL, 0, 111, 0, 1)"
        )
        await raw.commit()

    await init_db(db_file)
    async with connect(db_file) as db:
        general = await _named_list_id(db, "general")
        row = await (await db.execute("SELECT named_list_id FROM items WHERE id=1")).fetchone()
        assert row["named_list_id"] == general
