from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from bot.config import settings
from bot.db.users import upsert_user
from bot.services.notify import notify_items_added


def make_bot():
    bot = MagicMock()
    bot.send_message = AsyncMock()
    bot.me = AsyncMock(return_value=SimpleNamespace(username="testbot"))
    return bot


def adder(uid=111, first_name="Alice", username="alice"):
    return SimpleNamespace(id=uid, first_name=first_name, username=username)


@pytest.fixture(autouse=True)
def _webapp_cfg(monkeypatch):
    # open_app_keyboard needs these to build buttons.
    monkeypatch.setattr(settings, "WEBAPP_URL", "https://example.com/app")
    monkeypatch.setattr(settings, "WEBAPP_SHORT_NAME", "list")


@pytest.mark.asyncio
async def test_noop_on_empty_names(monkeypatch):
    monkeypatch.setitem(settings.__dict__, "allowed_user_ids", [111, 222])
    bot = make_bot()
    await notify_items_added(bot, adder(), "private", [])
    bot.send_message.assert_not_called()


@pytest.mark.asyncio
async def test_noop_when_adder_is_only_member(monkeypatch):
    monkeypatch.setitem(settings.__dict__, "allowed_user_ids", [111])
    bot = make_bot()
    await notify_items_added(bot, adder(), "private", ["молоко"])
    bot.send_message.assert_not_called()


@pytest.mark.asyncio
async def test_group_add_dms_others_only(monkeypatch):
    monkeypatch.setitem(settings.__dict__, "allowed_user_ids", [111, 222])
    bot = make_bot()
    await notify_items_added(bot, adder(), "supergroup", ["молоко", "хлеб"])

    assert bot.send_message.call_count == 1
    call = bot.send_message.call_args_list[0]
    assert call.args[0] == 222            # DM recipient, not the group
    assert "Alice" in call.args[1]
    assert "молоко" in call.args[1] and "хлеб" in call.args[1]
    kb = call.kwargs["reply_markup"]
    assert kb.inline_keyboard[0][0].web_app is not None


@pytest.mark.asyncio
async def test_private_add_posts_group_and_dms(db, monkeypatch):
    monkeypatch.setitem(settings.__dict__, "allowed_user_ids", [111, 222])
    await upsert_user(db, 222, "Bob", "bob")
    bot = make_bot()
    await notify_items_added(bot, adder(), "private", ["молоко"])

    targets = [c.args[0] for c in bot.send_message.call_args_list]
    assert settings.TARGET_CHAT_ID in targets
    assert 222 in targets

    group_call = next(
        c for c in bot.send_message.call_args_list
        if c.args[0] == settings.TARGET_CHAT_ID
    )
    assert 'tg://user?id=222' in group_call.args[1]
    assert "Bob" in group_call.args[1]
    assert "молоко" in group_call.args[1]
    assert group_call.kwargs["reply_markup"].inline_keyboard[0][0].url is not None


@pytest.mark.asyncio
async def test_private_add_no_group_when_target_none(db, monkeypatch):
    monkeypatch.setitem(settings.__dict__, "allowed_user_ids", [111, 222])
    monkeypatch.setattr(settings, "TARGET_CHAT_ID", None)
    bot = make_bot()
    await notify_items_added(bot, adder(), "private", ["молоко"])

    assert bot.send_message.call_count == 1
    assert bot.send_message.call_args_list[0].args[0] == 222


@pytest.mark.asyncio
async def test_blocked_dm_does_not_abort_fanout(db, monkeypatch):
    monkeypatch.setitem(settings.__dict__, "allowed_user_ids", [111, 222, 333])
    monkeypatch.setattr(settings, "TARGET_CHAT_ID", None)

    bot = make_bot()

    async def side_effect(chat_id, *a, **k):
        if chat_id == 222:
            raise RuntimeError("blocked")

    bot.send_message.side_effect = side_effect
    await notify_items_added(bot, adder(), "private", ["молоко"])

    targets = [c.args[0] for c in bot.send_message.call_args_list]
    assert 333 in targets  # reached despite 222 failing


@pytest.mark.asyncio
async def test_group_mention_fallback_for_unknown_name(db, monkeypatch):
    monkeypatch.setitem(settings.__dict__, "allowed_user_ids", [111, 222])
    bot = make_bot()
    await notify_items_added(bot, adder(), "private", ["молоко"])

    group_call = next(
        c for c in bot.send_message.call_args_list
        if c.args[0] == settings.TARGET_CHAT_ID
    )
    assert 'tg://user?id=222' in group_call.args[1]
    assert "участник" in group_call.args[1]


@pytest.mark.asyncio
async def test_html_escape(db, monkeypatch):
    monkeypatch.setitem(settings.__dict__, "allowed_user_ids", [111, 222])
    monkeypatch.setattr(settings, "TARGET_CHAT_ID", None)
    bot = make_bot()
    await notify_items_added(
        bot, adder(first_name="A&B"), "private", ["<b>x</b>"]
    )
    text = bot.send_message.call_args_list[0].args[1]
    assert "A&amp;B" in text
    assert "&lt;b&gt;x&lt;/b&gt;" in text


@pytest.mark.asyncio
async def test_group_post_uses_pinned_thread(db, monkeypatch):
    from bot.db.settings_kv import PINNED_THREAD_ID_KEY, set_setting

    monkeypatch.setitem(settings.__dict__, "allowed_user_ids", [111, 222])
    await set_setting(db, PINNED_THREAD_ID_KEY, "7")
    bot = make_bot()
    await notify_items_added(bot, adder(), "private", ["молоко"])

    group_call = next(
        c for c in bot.send_message.call_args_list
        if c.args[0] == settings.TARGET_CHAT_ID
    )
    assert group_call.kwargs["message_thread_id"] == 7
