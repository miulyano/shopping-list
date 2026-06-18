from __future__ import annotations

import html
import logging

from aiogram import Bot
from aiogram.types import User

from bot.config import settings
from bot.db.settings_kv import PINNED_THREAD_ID_KEY, get_setting
from bot.db.store import connect
from bot.db.users import UserName, get_users
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


def _display_name_from_record(uid: int, rec: UserName | None) -> str:
    if rec is not None:
        if rec.first_name:
            return rec.first_name
        if rec.username:
            return f"@{rec.username}"
    return "участник"


def _items_block(adder_name: str, names: list[str]) -> str:
    """Header (adder + pluralized count) followed by a bullet list of items."""
    word = plural_ru(len(names), ("товар", "товара", "товаров"))
    header = (
        f"<b>{html.escape(adder_name)}</b> добавил(а) {len(names)} {word} в список:"
    )
    lines = "\n".join(f"• {html.escape(n)}" for n in names)
    return f"{header}\n{lines}"


async def notify_items_added(
    bot: Bot,
    adder: User,
    chat_type: str,
    added_names: list[str],
) -> None:
    """Fan-out notifications after a successful add.

    GROUP add   -> DM every member except the adder (web_app open-list button).
    PRIVATE add -> (a) one message to TARGET_CHAT_ID (if set) @mentioning every
                   member except the adder, with a url open-list button, AND
                   (b) DM every member except the adder (web_app button).

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
    body = _items_block(adder_name, added_names)

    me = await bot.me()
    dm_kb = open_app_keyboard("private", me.username)
    group_kb = open_app_keyboard(_GROUP_CHAT_TYPE, me.username)

    # Group post — only when the add came from a private chat and a group is set.
    if chat_type == "private" and settings.TARGET_CHAT_ID is not None:
        async with connect() as db:
            known = await get_users(db, recipients)
            pinned = await get_setting(db, PINNED_THREAD_ID_KEY)
        thread_id = int(pinned) if pinned and pinned != "0" else None
        mentions = ", ".join(
            f'<a href="tg://user?id={uid}">'
            f"{html.escape(_display_name_from_record(uid, known.get(uid)))}</a>"
            for uid in recipients
        )
        group_text = f"{body}\n\n{mentions}"
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
