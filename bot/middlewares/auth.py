from typing import Any, Awaitable, Callable

from aiogram import BaseMiddleware
from aiogram.types import TelegramObject

from bot.config import settings
from bot.db.settings_kv import PINNED_THREAD_ID_KEY, get_setting
from bot.db.store import connect


def _is_pin_command(event: Any) -> bool:
    text = getattr(event, "text", None) or getattr(event, "caption", None) or ""
    if not text:
        return False
    return text.split()[0].split("@")[0] == "/pin"


class AuthMiddleware(BaseMiddleware):
    """Whitelist + chat + topic filter.

    Pass through if user is whitelisted AND chat is private OR matches
    TARGET_CHAT_ID. In a forum-style supergroup, also require the message to
    be in the topic chosen via /pin (stored in `app_settings.pinned_thread_id`).
    If no topic is pinned yet, all topics are allowed (back-compat).

    Anything else is silently dropped (no reply in foreign chats/topics).

    Works for both `Message` and `ChatMemberUpdated` events. Topic filtering
    only applies to `Message` (ChatMemberUpdated has no message_thread_id).
    """

    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        user = getattr(event, "from_user", None)
        chat = getattr(event, "chat", None)
        if user is None or chat is None:
            return
        if user.id not in settings.allowed_user_ids:
            return
        if chat.type != "private":
            if settings.TARGET_CHAT_ID is None or chat.id != settings.TARGET_CHAT_ID:
                return
            if hasattr(event, "message_thread_id") and not _is_pin_command(event):
                async with connect() as db:
                    pinned = await get_setting(db, PINNED_THREAD_ID_KEY)
                if pinned is not None:
                    current = event.message_thread_id or 0
                    if str(current) != pinned:
                        return
        return await handler(event, data)
