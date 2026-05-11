from types import SimpleNamespace

import pytest

from bot.config import settings
from bot.db.settings_kv import PINNED_THREAD_ID_KEY, set_setting
from bot.middlewares.auth import AuthMiddleware


def _msg(
    user_id: int | None,
    chat_type: str,
    chat_id: int,
    *,
    message_thread_id: int | None = None,
    text: str | None = None,
    with_thread_attr: bool = False,
):
    kwargs = dict(
        from_user=SimpleNamespace(id=user_id) if user_id is not None else None,
        chat=SimpleNamespace(type=chat_type, id=chat_id),
    )
    if with_thread_attr or message_thread_id is not None:
        kwargs["message_thread_id"] = message_thread_id
    if text is not None:
        kwargs["text"] = text
    return SimpleNamespace(**kwargs)


@pytest.mark.asyncio
async def test_allows_whitelisted_user_in_dm():
    mw = AuthMiddleware()
    called = []

    async def handler(event, data):
        called.append(True)

    await mw(handler, _msg(111, "private", 111), {})
    assert called == [True]


@pytest.mark.asyncio
async def test_blocks_unknown_user():
    mw = AuthMiddleware()
    called = []

    async def handler(event, data):
        called.append(True)

    await mw(handler, _msg(999, "private", 999), {})
    assert called == []


@pytest.mark.asyncio
async def test_allows_target_group():
    mw = AuthMiddleware()
    called = []

    async def handler(event, data):
        called.append(True)

    await mw(handler, _msg(111, "group", settings.TARGET_CHAT_ID), {})
    assert called == [True]


@pytest.mark.asyncio
async def test_blocks_foreign_group():
    mw = AuthMiddleware()
    called = []

    async def handler(event, data):
        called.append(True)

    await mw(handler, _msg(111, "group", -999_999), {})
    assert called == []


@pytest.mark.asyncio
async def test_topic_no_pin_allows_all_topics(db):
    mw = AuthMiddleware()
    called = []

    async def handler(event, data):
        called.append(True)

    await mw(
        handler,
        _msg(111, "supergroup", settings.TARGET_CHAT_ID, message_thread_id=42),
        {},
    )
    assert called == [True]


@pytest.mark.asyncio
async def test_topic_pinned_allows_matching(db):
    await set_setting(db, PINNED_THREAD_ID_KEY, "42")
    mw = AuthMiddleware()
    called = []

    async def handler(event, data):
        called.append(True)

    await mw(
        handler,
        _msg(111, "supergroup", settings.TARGET_CHAT_ID, message_thread_id=42),
        {},
    )
    assert called == [True]


@pytest.mark.asyncio
async def test_topic_pinned_blocks_other_topic(db):
    await set_setting(db, PINNED_THREAD_ID_KEY, "42")
    mw = AuthMiddleware()
    called = []

    async def handler(event, data):
        called.append(True)

    await mw(
        handler,
        _msg(111, "supergroup", settings.TARGET_CHAT_ID, message_thread_id=99),
        {},
    )
    assert called == []


@pytest.mark.asyncio
async def test_topic_pinned_general_blocks_topic(db):
    await set_setting(db, PINNED_THREAD_ID_KEY, "0")
    mw = AuthMiddleware()
    called = []

    async def handler(event, data):
        called.append(True)

    await mw(
        handler,
        _msg(111, "supergroup", settings.TARGET_CHAT_ID, message_thread_id=42),
        {},
    )
    assert called == []


@pytest.mark.asyncio
async def test_topic_pinned_general_allows_none(db):
    await set_setting(db, PINNED_THREAD_ID_KEY, "0")
    mw = AuthMiddleware()
    called = []

    async def handler(event, data):
        called.append(True)

    await mw(
        handler,
        _msg(
            111,
            "supergroup",
            settings.TARGET_CHAT_ID,
            message_thread_id=None,
            with_thread_attr=True,
        ),
        {},
    )
    assert called == [True]


@pytest.mark.asyncio
async def test_pin_command_bypasses_topic_filter(db):
    await set_setting(db, PINNED_THREAD_ID_KEY, "42")
    mw = AuthMiddleware()
    called = []

    async def handler(event, data):
        called.append(True)

    await mw(
        handler,
        _msg(
            111,
            "supergroup",
            settings.TARGET_CHAT_ID,
            message_thread_id=99,
            text="/pin",
        ),
        {},
    )
    assert called == [True]


@pytest.mark.asyncio
async def test_chat_member_updated_bypasses_topic_filter(db):
    await set_setting(db, PINNED_THREAD_ID_KEY, "42")
    mw = AuthMiddleware()
    called = []

    async def handler(event, data):
        called.append(True)

    event = SimpleNamespace(
        from_user=SimpleNamespace(id=111),
        chat=SimpleNamespace(type="supergroup", id=settings.TARGET_CHAT_ID),
    )
    await mw(handler, event, {})
    assert called == [True]
