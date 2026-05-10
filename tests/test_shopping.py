import pytest

from bot.services.parser import ParsedItem
from bot.services.shopping import (
    add_items,
    archive_count,
    archive_if_all_done,
    ensure_active_list,
    get_active_list_id,
    get_archive,
    get_state,
    toggle_item,
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
    assert state2.items[0].done is True

    await toggle_item(db, a_id, user_id=111)
    state3 = await get_state(db)
    assert state3.items[0].done is False
    assert state3.items[0].checked_by is None


@pytest.mark.asyncio
async def test_toggle_unknown_item_returns_none(db):
    result = await toggle_item(db, 9999, user_id=111)
    assert result is None
