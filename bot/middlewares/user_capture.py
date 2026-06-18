import logging
from typing import Any, Awaitable, Callable

from aiogram import BaseMiddleware
from aiogram.types import TelegramObject

from bot.db.store import connect
from bot.db.users import upsert_user


logger = logging.getLogger(__name__)


class UserCaptureMiddleware(BaseMiddleware):
    """Persist `from_user.{first_name,username}` on every authorized message.

    Registered after `AuthMiddleware`, so only whitelisted users in allowed
    chats reach here. Best-effort: a DB hiccup must never block message
    handling, so the upsert is wrapped in try/except.
    """

    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        user = getattr(event, "from_user", None)
        if user is not None:
            try:
                async with connect() as db:
                    await upsert_user(db, user.id, user.first_name, user.username)
            except Exception:
                logger.exception("user capture failed")
        return await handler(event, data)
