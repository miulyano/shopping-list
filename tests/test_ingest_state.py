import time

import pytest

from bot.services import ingest_state


@pytest.mark.asyncio
async def test_start_creates_event_with_initial_stage(db):
    eid = await ingest_state.start(db, 111, "voice", "Распознаю…", "0:08")
    assert eid > 0

    ev = await ingest_state.get_active(db, 111)
    assert ev is not None
    assert ev.id == eid
    assert ev.kind == "voice"
    assert ev.stage == "transcribing"
    assert ev.title == "Распознаю…"
    assert ev.sub == "0:08"
    assert ev.finished_at is None


@pytest.mark.asyncio
async def test_start_text_kind_uses_parsing_stage(db):
    await ingest_state.start(db, 111, "text", "Разбираю…", None)
    ev = await ingest_state.get_active(db, 111)
    assert ev.stage == "parsing"


@pytest.mark.asyncio
async def test_update_changes_stage_and_keeps_old_fields(db):
    eid = await ingest_state.start(db, 111, "voice", "Распознаю…", "0:08")
    await ingest_state.update(db, eid, "parsing", title="Извлекаю товары…")
    ev = await ingest_state.get_active(db, 111)
    assert ev.stage == "parsing"
    assert ev.title == "Извлекаю товары…"
    assert ev.sub == "0:08"


@pytest.mark.asyncio
async def test_finish_success_stores_added_and_marks_finished(db):
    eid = await ingest_state.start(db, 111, "text", "Разбираю…", None)
    await ingest_state.finish_success(
        db, eid,
        [{"name": "Молоко", "qty": "1 л"}, {"name": "Хлеб", "qty": None}],
        "Добавлено 2 товара", "Молоко, Хлеб",
    )
    ev = await ingest_state.get_active(db, 111)
    assert ev is not None
    assert ev.stage == "success"
    assert ev.title == "Добавлено 2 товара"
    assert ev.finished_at is not None
    assert ev.added == [
        {"name": "Молоко", "qty": "1 л"},
        {"name": "Хлеб", "qty": None},
    ]


@pytest.mark.asyncio
async def test_get_active_filters_out_old_success(db):
    eid = await ingest_state.start(db, 111, "text", "Разбираю…", None)
    await ingest_state.finish_success(db, eid, [], "ok", None)

    # Backdate finished_at past TTL
    stale = int(time.time()) - ingest_state.SUCCESS_TTL_SEC - 5
    await db.execute(
        "UPDATE ingest_events SET finished_at=?, updated_at=? WHERE id=?",
        (stale, stale, eid),
    )
    await db.commit()

    assert await ingest_state.get_active(db, 111) is None


@pytest.mark.asyncio
async def test_get_active_keeps_in_flight_event(db):
    await ingest_state.start(db, 111, "voice", "Распознаю…", None)
    ev = await ingest_state.get_active(db, 111)
    assert ev is not None
    assert ev.finished_at is None


@pytest.mark.asyncio
async def test_get_active_returns_latest(db):
    e1 = await ingest_state.start(db, 111, "text", "Первый", None)
    await ingest_state.finish_success(db, e1, [], "ok", None)
    e2 = await ingest_state.start(db, 111, "voice", "Второй", None)
    ev = await ingest_state.get_active(db, 111)
    assert ev.id == e2


@pytest.mark.asyncio
async def test_get_active_scoped_by_user(db):
    await ingest_state.start(db, 111, "text", "Мой", None)
    ev = await ingest_state.get_active(db, 222)
    assert ev is None


@pytest.mark.asyncio
async def test_finish_error_marks_stage(db):
    eid = await ingest_state.start(db, 111, "voice", "Распознаю…", None)
    await ingest_state.finish_error(db, eid, "Сломалось", "детали")
    # Errors aren't returned by get_active (only in-flight + recent success)
    assert await ingest_state.get_active(db, 111) is None
