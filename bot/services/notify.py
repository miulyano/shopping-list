from __future__ import annotations

import html
import logging

from aiogram import Bot
from aiogram.types import User

from bot.config import settings
from bot.db.settings_kv import PINNED_THREAD_ID_KEY, get_setting
from bot.db.store import connect
from bot.handlers._common import open_app_keyboard, plural_ru


logger = logging.getLogger(__name__)

# open_app_keyboard only special-cases "private"; any other value takes the
# url-link branch used for groups.
_GROUP_CHAT_TYPE = "supergroup"


def _display_name_from_user(u: User) -> str:
    if u.first_name:
        return u.first_name
    if u.username:
        return f"@{u.username}"
    return "кто-то"


async def _mentions(bot: Bot, chat_id: int, user_ids: list[int]) -> list[str]:
    """Build `@username` tags for current members of `chat_id`.

    Username is read live from Telegram via `get_chat_member`, so it is always
    current and needs no prior interaction with the bot. A member without a
    public username cannot be tagged at all (the only alternative is a
    `tg://user?id=` link, which we deliberately don't use), so they are simply
    skipped — they still receive a DM elsewhere. Members who left the chat or
    fail to resolve are skipped too.
    """
    tags: list[str] = []
    for uid in user_ids:
        try:
            member = await bot.get_chat_member(chat_id, uid)
        except Exception:
            logger.info("get_chat_member failed for %s", uid)
            continue
        if member.status in ("left", "kicked"):
            continue
        if member.user.username:
            tags.append(f"@{member.user.username}")
    return tags


def _items_block(
    adder_name: str,
    names: list[str],
    list_name: str | None = None,
    unresolved: bool = False,
) -> str:
    """Header (adder + pluralized count + target list) followed by a bullet list."""
    word = plural_ru(len(names), ("товар", "товара", "товаров"))
    where = f" в список «{html.escape(list_name)}»" if list_name else " в список"
    header = f"<b>{html.escape(adder_name)}</b> добавил(а) {len(names)} {word}{where}:"
    lines = "\n".join(f"• {html.escape(n)}" for n in names)
    block = f"{header}\n\n{lines}"
    if unresolved:
        block += "\n\n⚠️ Не распознал, в какой список — положил в «Общее»."
    return block


async def notify_items_added(
    bot: Bot,
    adder: User,
    chat_type: str,
    added_names: list[str],
    list_name: str | None = None,
    list_key: str | None = None,
    unresolved: bool = False,
) -> None:
    """Fan-out notifications after a successful add.

    GROUP add   -> DM every member except the adder (web_app open-list button).
    PRIVATE add -> (a) one message to TARGET_CHAT_ID (if set) @mentioning every
                   member except the adder, with a url open-list button, AND
                   (b) DM every member except the adder (web_app button).

    `list_name`/`list_key` tag the message with the target named list and make
    every open-list button deep-link straight into it.

    No-op when there are no added items or no recipients besides the adder.
    Each send is best-effort: a blocked DM or a missing group does not abort
    the rest of the fan-out.
    """
    if not added_names:
        return
    recipients = [uid for uid in settings.allowed_user_ids if uid != adder.id]
    if not recipients:
        return

    adder_name = _display_name_from_user(adder)
    body = _items_block(adder_name, added_names, list_name, unresolved)

    me = await bot.me()
    dm_kb = open_app_keyboard("private", me.username, list_key)
    group_kb = open_app_keyboard(_GROUP_CHAT_TYPE, me.username, list_key)

    # Group post — only when the add came from a private chat and a group is set.
    if chat_type == "private" and settings.TARGET_CHAT_ID is not None:
        async with connect() as db:
            pinned = await get_setting(db, PINNED_THREAD_ID_KEY)
        thread_id = int(pinned) if pinned and pinned != "0" else None
        tags = await _mentions(bot, settings.TARGET_CHAT_ID, recipients)
        group_text = f"{body}\n\n{', '.join(tags)}" if tags else body
        try:
            await bot.send_message(
                settings.TARGET_CHAT_ID,
                group_text,
                message_thread_id=thread_id,
                reply_markup=group_kb,
            )
        except Exception:
            logger.exception("Group notification failed")

    # DM every recipient (both cases).
    for uid in recipients:
        try:
            await bot.send_message(uid, body, reply_markup=dm_kb)
        except Exception:
            logger.info("DM to %s failed (likely not started / blocked)", uid)
