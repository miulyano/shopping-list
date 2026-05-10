from typing import Any, Awaitable, Callable

from aiogram import BaseMiddleware
from aiogram.types import TelegramObject

from bot.config import settings


class AuthMiddleware(BaseMiddleware):
    """Whitelist + chat filter.

    Pass through if user is whitelisted AND chat is private OR matches TARGET_CHAT_ID.
    Anything else is silently dropped (no reply in foreign chats).

    Works for both `Message` and `ChatMemberUpdated` events — both expose
    `from_user` and `chat` attributes.
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
        return await handler(event, data)
