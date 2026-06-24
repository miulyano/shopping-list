import pytest

from bot.services.parser import ParsedItem
from bot.services.shopping import (
    add_items,
    archive_count,
    archive_purchased,
    delete_archive_list,
    delete_item,
    ensure_active_list,
    get_archive,
    get_archive_list,
    get_state,
    reuse_archive_list,
    set_item_done,
    update_item,
)


@pytest.mark.asyncio
async def test_ensure_active_list_creates_then_reuses(db):
    list_id = await ensure_active_list(db)
    assert list_id == 1
    again = await ensure_active_list(db)
    assert again == 1


@pytest.mark.asyncio
async def test_add_items_inserts_with_positions(db):
    list_id, names = await add_items(
        db,
        [ParsedItem("Молоко", "1 л"), ParsedItem("Хлеб", None)],
        user_id=111,
    )
    assert names == ["молоко", "хлеб"]
    state = await get_state(db)
    assert state is not None
    assert state.id == list_id
    assert [i.name for i in state.items] == ["молоко", "хлеб"]
    assert state.items[0].position < state.items[1].position
    assert state.items[0].qty == "1 л"
    assert state.items[1].qty is None


@pytest.mark.asyncio
async def test_add_items_persists_category(db):
    await add_items(
        db,
        [
            ParsedItem("Молоко", "1 л", category="food"),
            ParsedItem("Стиральный порошок", None, category="home"),
            ParsedItem("Зубная паста", None, category="care"),
        ],
        user_id=111,
    )
    state = await get_state(db)
    assert [(i.name, i.category) for i in state.items] == [
        ("молоко", "food"),
        ("стиральный порошок", "home"),
        ("зубная паста", "care"),
    ]


@pytest.mark.asyncio
async def test_add_items_default_category_is_food(db):
    await add_items(db, [ParsedItem("Хлеб", None)], user_id=111)
    state = await get_state(db)
    assert state.items[0].category == "food"


@pytest.mark.asyncio
async def test_add_items_lowercases_and_preserves_brands(db):
    _, names = await add_items(
        db,
        [
            ParsedItem("Молоко Простоквашино 2.5%", "1 л", brands=["Простоквашино"]),
            ParsedItem("Coca-Cola", None, brands=["Coca-Cola"]),
        ],
        user_id=111,
    )
    assert names == ["молоко Простоквашино 2.5%", "Coca-Cola"]


@pytest.mark.asyncio
async def test_add_items_idempotent_on_preformatted_names(db):
    """Re-adding an already-formatted name keeps it byte-identical (defence-in-depth)."""
    _, names = await add_items(
        db,
        [ParsedItem("молоко Простоквашино", None, brands=["Простоквашино"])],
        user_id=111,
    )
    assert names == ["молоко Простоквашино"]


@pytest.mark.asyncio
async def test_set_done_marks_and_records_user(db):
    _, _ = await add_items(db, [ParsedItem("Молоко")], user_id=111)
    state = await get_state(db)
    item_id = state.items[0].id

    result = await set_item_done(db, item_id, user_id=222, done=True)
    assert result is not None
    list_id, done, archived = result
    assert done is True
    # only item bought → its named list is archived; `archived` is its id
    assert archived is not None

    state2 = await get_state(db)
    # active session persists (empty) — items moved to an archived snapshot
    assert state2 is not None
    assert state2.items == []


@pytest.mark.asyncio
async def test_archive_only_when_all_done(db):
    await add_items(db, [ParsedItem("A"), ParsedItem("B")], user_id=111)
    state = await get_state(db)
    a_id, b_id = state.items[0].id, state.items[1].id

    _, _, archived_a = await set_item_done(db, a_id, user_id=111, done=True)
    assert archived_a is None  # B still unbought

    _, _, archived_b = await set_item_done(db, b_id, user_id=111, done=True)
    assert archived_b is not None  # whole list bought → archived

    assert await archive_count(db) == 1
    archive = await get_archive(db)
    assert len(archive) == 1
    assert {i.name for i in archive[0].items} == {"a", "b"}


@pytest.mark.asyncio
async def test_unset_done_clears_user_and_timestamp(db):
    await add_items(db, [ParsedItem("A"), ParsedItem("B")], user_id=111)
    state = await get_state(db)
    a_id = state.items[0].id

    await set_item_done(db, a_id, user_id=111, done=True)
    state2 = await get_state(db)
    item_a = next(i for i in state2.items if i.id == a_id)
    assert item_a.done is True

    await set_item_done(db, a_id, user_id=111, done=False)
    state3 = await get_state(db)
    item_a = next(i for i in state3.items if i.id == a_id)
    assert item_a.done is False
    assert item_a.checked_by is None


@pytest.mark.asyncio
async def test_set_done_idempotent(db):
    """Repeated set_item_done with the same value is a no-op (besides bumping
    checked_at when done=True). This is the core property that makes
    concurrent toggle requests safe."""
    await add_items(db, [ParsedItem("A"), ParsedItem("B")], user_id=111)
    state = await get_state(db)
    a_id = state.items[0].id

    _, done1, _ = await set_item_done(db, a_id, user_id=111, done=True)
    _, done2, _ = await set_item_done(db, a_id, user_id=111, done=True)
    assert done1 is True and done2 is True
    state2 = await get_state(db)
    item_a = next(i for i in state2.items if i.id == a_id)
    assert item_a.done is True

    _, done3, _ = await set_item_done(db, a_id, user_id=111, done=False)
    _, done4, _ = await set_item_done(db, a_id, user_id=111, done=False)
    assert done3 is False and done4 is False
    state3 = await get_state(db)
    item_a = next(i for i in state3.items if i.id == a_id)
    assert item_a.done is False
    assert item_a.checked_by is None


@pytest.mark.asyncio
async def test_checked_items_sink_to_bottom(db):
    await add_items(
        db,
        [ParsedItem("A"), ParsedItem("B"), ParsedItem("C")],
        user_id=111,
    )
    state = await get_state(db)
    a_id, b_id, _c_id = (i.id for i in state.items)

    await set_item_done(db, b_id, user_id=111, done=True)
    state2 = await get_state(db)
    assert [i.name for i in state2.items] == ["a", "c", "b"]
    assert [i.done for i in state2.items] == [False, False, True]

    await set_item_done(db, a_id, user_id=111, done=True)
    state3 = await get_state(db)
    assert [i.name for i in state3.items] == ["c", "a", "b"]
    assert [i.done for i in state3.items] == [False, True, True]

    await set_item_done(db, a_id, user_id=111, done=False)
    state4 = await get_state(db)
    assert [i.name for i in state4.items] == ["a", "c", "b"]
    assert [i.done for i in state4.items] == [False, False, True]


@pytest.mark.asyncio
async def test_recently_checked_goes_to_end_of_checked_block(db, monkeypatch):
    await add_items(
        db,
        [ParsedItem("A"), ParsedItem("B"), ParsedItem("C")],
        user_id=111,
    )
    state = await get_state(db)
    a_id, b_id, _c_id = (i.id for i in state.items)

    import bot.services.shopping as svc

    monkeypatch.setattr(svc.time, "time", lambda: 1000.0)
    await set_item_done(db, a_id, user_id=111, done=True)
    monkeypatch.setattr(svc.time, "time", lambda: 2000.0)
    await set_item_done(db, b_id, user_id=111, done=True)

    # Checked items sink to the bottom; the most recently checked goes last,
    # so the order is: not-done (c), then oldest-checked (a), newest-checked (b).
    state2 = await get_state(db)
    assert [i.name for i in state2.items] == ["c", "a", "b"]
    assert [i.done for i in state2.items] == [False, True, True]


@pytest.mark.asyncio
async def test_set_done_unknown_item_returns_none(db):
    result = await set_item_done(db, 9999, user_id=111, done=True)
    assert result is None


@pytest.mark.asyncio
async def test_update_item_changes_name_and_qty(db):
    await add_items(db, [ParsedItem("Молоко", "1 л")], user_id=111)
    state = await get_state(db)
    item_id = state.items[0].id

    list_id = await update_item(db, item_id, "Молоко 2,5%", "2 л")
    assert list_id == state.id

    state2 = await get_state(db)
    assert state2.items[0].name == "Молоко 2,5%"
    assert state2.items[0].qty == "2 л"


@pytest.mark.asyncio
async def test_update_item_sets_qty_to_none_when_blank(db):
    await add_items(db, [ParsedItem("Хлеб", "1 шт")], user_id=111)
    item_id = (await get_state(db)).items[0].id

    await update_item(db, item_id, "Хлеб", "")
    state = await get_state(db)
    assert state.items[0].qty is None


@pytest.mark.asyncio
async def test_update_item_changes_category(db):
    await add_items(db, [ParsedItem("Молоко", "1 л", category="food")], user_id=111)
    item_id = (await get_state(db)).items[0].id

    await update_item(db, item_id, "Молоко", "1 л", "home")
    state = await get_state(db)
    assert state.items[0].category == "home"


@pytest.mark.asyncio
async def test_update_item_keeps_category_when_omitted(db):
    await add_items(db, [ParsedItem("Молоко", "1 л", category="care")], user_id=111)
    item_id = (await get_state(db)).items[0].id

    await update_item(db, item_id, "Молоко 2,5%", "2 л")
    state = await get_state(db)
    assert state.items[0].category == "care"


@pytest.mark.asyncio
async def test_update_unknown_item_returns_none(db):
    assert await update_item(db, 9999, "x", None) is None


@pytest.mark.asyncio
async def test_delete_item_removes_row(db):
    await add_items(db, [ParsedItem("A"), ParsedItem("B")], user_id=111)
    state = await get_state(db)
    a_id = state.items[0].id

    list_id = await delete_item(db, a_id)
    assert list_id == state.id

    state2 = await get_state(db)
    assert [i.name for i in state2.items] == ["b"]


@pytest.mark.asyncio
async def test_delete_unknown_item_returns_none(db):
    assert await delete_item(db, 9999) is None


@pytest.mark.asyncio
async def test_get_archive_list_only_archived(db):
    await add_items(db, [ParsedItem("A")], user_id=111)
    item_id = (await get_state(db)).items[0].id
    _, _, archived = await set_item_done(db, item_id, user_id=111, done=True)
    assert archived

    archive = await get_archive(db)
    archived_id = archive[0].id

    lst = await get_archive_list(db, archived_id)
    assert lst is not None
    assert [i.name for i in lst.items] == ["a"]


@pytest.mark.asyncio
async def test_get_archive_list_rejects_active(db):
    await add_items(db, [ParsedItem("A")], user_id=111)
    state = await get_state(db)
    assert await get_archive_list(db, state.id) is None


@pytest.mark.asyncio
async def test_delete_archive_list_cascades_items(db):
    await add_items(db, [ParsedItem("A"), ParsedItem("B")], user_id=111)
    state = await get_state(db)
    for it in state.items:
        await set_item_done(db, it.id, user_id=111, done=True)
    archived_id = (await get_archive(db))[0].id

    assert await delete_archive_list(db, archived_id) is True
    assert await get_archive_list(db, archived_id) is None
    assert len(await get_archive(db)) == 0


@pytest.mark.asyncio
async def test_delete_archive_list_unknown_returns_false(db):
    assert await delete_archive_list(db, 9999) is False


@pytest.mark.asyncio
async def test_reuse_archive_creates_new_active_with_items_undone(db):
    await add_items(
        db,
        [ParsedItem("Молоко", "1 л"), ParsedItem("Хлеб", None)],
        user_id=111,
    )
    state = await get_state(db)
    for it in state.items:
        await set_item_done(db, it.id, user_id=111, done=True)
    archived_id = (await get_archive(db))[0].id

    empty = await get_state(db)  # active session persists, now empty
    assert empty is not None and empty.items == []

    result = await reuse_archive_list(db, archived_id, user_id=222)
    assert result is not None
    new_list_id, added = result
    assert added == 2

    state2 = await get_state(db)
    assert state2 is not None
    assert state2.id == new_list_id
    assert [i.name for i in state2.items] == ["молоко", "хлеб"]
    assert all(not i.done for i in state2.items)
    assert state2.items[0].qty == "1 л"
    assert state2.items[0].added_by == 222


@pytest.mark.asyncio
async def test_reuse_archive_preserves_category(db):
    await add_items(
        db,
        [ParsedItem("Молоко", "1 л", category="food"), ParsedItem("Порошок", None, category="home")],
        user_id=111,
    )
    state = await get_state(db)
    for it in state.items:
        await set_item_done(db, it.id, user_id=111, done=True)
    archived_id = (await get_archive(db))[0].id

    await reuse_archive_list(db, archived_id, user_id=222)
    state2 = await get_state(db)
    assert {(i.name, i.category) for i in state2.items} == {("молоко", "food"), ("порошок", "home")}


@pytest.mark.asyncio
async def test_reuse_archive_appends_to_existing_active(db):
    # archive #1
    await add_items(db, [ParsedItem("A")], user_id=111)
    a_id = (await get_state(db)).items[0].id
    await set_item_done(db, a_id, user_id=111, done=True)
    archived_id = (await get_archive(db))[0].id

    # new active with one item
    await add_items(db, [ParsedItem("B")], user_id=111)
    active_before = await get_state(db)

    result = await reuse_archive_list(db, archived_id, user_id=111)
    assert result is not None
    new_list_id, added = result
    assert new_list_id == active_before.id
    assert added == 1

    state = await get_state(db)
    assert [i.name for i in state.items] == ["b", "a"]


@pytest.mark.asyncio
async def test_reuse_archive_unknown_returns_none(db):
    assert await reuse_archive_list(db, 9999, user_id=111) is None


@pytest.mark.asyncio
async def test_archive_purchased_splits_done_into_new_archive(db):
    await add_items(
        db,
        [ParsedItem("A"), ParsedItem("B"), ParsedItem("C")],
        user_id=111,
    )
    state = await get_state(db)
    a_id, b_id, _c_id = (i.id for i in state.items)

    await set_item_done(db, a_id, user_id=111, done=True)
    await set_item_done(db, b_id, user_id=111, done=True)

    result = await archive_purchased(db, state.id)
    assert result is not None
    archive_id, moved = result
    assert archive_id != state.id
    assert moved == 2

    active = await get_state(db)
    assert active is not None
    assert active.id == state.id
    assert [i.name for i in active.items] == ["c"]
    assert all(not i.done for i in active.items)
    assert active.items[0].position == 1

    archived = await get_archive_list(db, archive_id)
    assert archived is not None
    assert {i.name for i in archived.items} == {"a", "b"}
    assert all(i.done for i in archived.items)


@pytest.mark.asyncio
async def test_archive_purchased_noop_when_nothing_done(db):
    await add_items(db, [ParsedItem("A"), ParsedItem("B")], user_id=111)
    state = await get_state(db)

    assert await archive_purchased(db, state.id) is None
    assert await archive_count(db) == 0
    active = await get_state(db)
    assert [i.name for i in active.items] == ["a", "b"]


@pytest.mark.asyncio
async def test_archive_purchased_all_done_creates_archive_and_empties_active(db):
    await add_items(db, [ParsedItem("A"), ParsedItem("B")], user_id=111)
    state = await get_state(db)
    for it in state.items:
        # use update_item path doesn't toggle — call SQL via toggle is overkill;
        # but we want them done without triggering auto-archive.
        await db.execute(
            "UPDATE items SET done=1, checked_by=?, checked_at=? WHERE id=?",
            (111, 9999, it.id),
        )
    await db.commit()

    result = await archive_purchased(db, state.id)
    assert result is not None
    archive_id, moved = result
    assert moved == 2

    active = await get_state(db)
    assert active is not None
    assert active.id == state.id
    assert active.items == []

    archived = await get_archive_list(db, archive_id)
    assert archived is not None
    assert {i.name for i in archived.items} == {"a", "b"}


@pytest.mark.asyncio
async def test_archive_purchased_unknown_or_archived_returns_none(db):
    assert await archive_purchased(db, 9999) is None

    await add_items(db, [ParsedItem("A")], user_id=111)
    state = await get_state(db)
    a_id = state.items[0].id
    _, _, archived = await set_item_done(db, a_id, user_id=111, done=True)
    assert archived

    # state.id is now archived, not active — should reject
    assert await archive_purchased(db, state.id) is None
