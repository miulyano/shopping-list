from types import SimpleNamespace

import pytest

from bot.config import settings
from bot.middlewares.auth import AuthMiddleware


def _msg(user_id: int | None, chat_type: str, chat_id: int):
    return SimpleNamespace(
        from_user=SimpleNamespace(id=user_id) if user_id is not None else None,
        chat=SimpleNamespace(type=chat_type, id=chat_id),
    )


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
