import pytest

from bot.services.parser import ParsedItem
from bot.services.shopping import (
    add_items,
    archive_count,
    delete_archive_list,
    delete_item,
    ensure_active_list,
    get_archive,
    get_archive_list,
    get_state,
    reuse_archive_list,
    toggle_item,
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
    assert names == ["Молоко", "Хлеб"]
    state = await get_state(db)
    assert state is not None
    assert state.id == list_id
    assert [i.name for i in state.items] == ["Молоко", "Хлеб"]
    assert state.items[0].position < state.items[1].position
    assert state.items[0].qty == "1 л"
    assert state.items[1].qty is None


@pytest.mark.asyncio
async def test_toggle_marks_done_and_records_user(db):
    _, _ = await add_items(db, [ParsedItem("Молоко")], user_id=111)
    state = await get_state(db)
    item_id = state.items[0].id

    result = await toggle_item(db, item_id, user_id=222)
    assert result is not None
    list_id, done, archived = result
    assert done is True
    assert archived is True  # only one item, marking it done archives the list

    state2 = await get_state(db)
    assert state2 is None  # active list is gone


@pytest.mark.asyncio
async def test_archive_only_when_all_done(db):
    await add_items(db, [ParsedItem("A"), ParsedItem("B")], user_id=111)
    state = await get_state(db)
    a_id, b_id = state.items[0].id, state.items[1].id

    _, _, archived_a = await toggle_item(db, a_id, user_id=111)
    assert archived_a is False

    _, _, archived_b = await toggle_item(db, b_id, user_id=111)
    assert archived_b is True

    assert await archive_count(db) == 1
    archive = await get_archive(db)
    assert len(archive) == 1
    assert {i.name for i in archive[0].items} == {"A", "B"}


@pytest.mark.asyncio
async def test_toggle_back_unmarks(db):
    await add_items(db, [ParsedItem("A"), ParsedItem("B")], user_id=111)
    state = await get_state(db)
    a_id = state.items[0].id

    await toggle_item(db, a_id, user_id=111)
    state2 = await get_state(db)
    item_a = next(i for i in state2.items if i.id == a_id)
    assert item_a.done is True

    await toggle_item(db, a_id, user_id=111)
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

    await toggle_item(db, b_id, user_id=111)
    state2 = await get_state(db)
    assert [i.name for i in state2.items] == ["A", "C", "B"]
    assert [i.done for i in state2.items] == [False, False, True]

    await toggle_item(db, a_id, user_id=111)
    state3 = await get_state(db)
    assert [i.name for i in state3.items] == ["C", "A", "B"]
    assert [i.done for i in state3.items] == [False, True, True]

    await toggle_item(db, a_id, user_id=111)
    state4 = await get_state(db)
    assert [i.name for i in state4.items] == ["A", "C", "B"]
    assert [i.done for i in state4.items] == [False, False, True]


@pytest.mark.asyncio
async def test_toggle_unknown_item_returns_none(db):
    result = await toggle_item(db, 9999, user_id=111)
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
    assert [i.name for i in state2.items] == ["B"]


@pytest.mark.asyncio
async def test_delete_unknown_item_returns_none(db):
    assert await delete_item(db, 9999) is None


@pytest.mark.asyncio
async def test_get_archive_list_only_archived(db):
    await add_items(db, [ParsedItem("A")], user_id=111)
    item_id = (await get_state(db)).items[0].id
    _, _, archived = await toggle_item(db, item_id, user_id=111)
    assert archived

    archive = await get_archive(db)
    archived_id = archive[0].id

    lst = await get_archive_list(db, archived_id)
    assert lst is not None
    assert [i.name for i in lst.items] == ["A"]


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
        await toggle_item(db, it.id, user_id=111)
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
        await toggle_item(db, it.id, user_id=111)
    archived_id = (await get_archive(db))[0].id

    assert await get_state(db) is None  # no active

    result = await reuse_archive_list(db, archived_id, user_id=222)
    assert result is not None
    new_list_id, added = result
    assert added == 2

    state2 = await get_state(db)
    assert state2 is not None
    assert state2.id == new_list_id
    assert [i.name for i in state2.items] == ["Молоко", "Хлеб"]
    assert all(not i.done for i in state2.items)
    assert state2.items[0].qty == "1 л"
    assert state2.items[0].added_by == 222


@pytest.mark.asyncio
async def test_reuse_archive_appends_to_existing_active(db):
    # archive #1
    await add_items(db, [ParsedItem("A")], user_id=111)
    a_id = (await get_state(db)).items[0].id
    await toggle_item(db, a_id, user_id=111)
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
    assert [i.name for i in state.items] == ["B", "A"]


@pytest.mark.asyncio
async def test_reuse_archive_unknown_returns_none(db):
    assert await reuse_archive_list(db, 9999, user_id=111) is None
