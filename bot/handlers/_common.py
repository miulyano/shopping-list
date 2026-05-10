from typing import Iterable

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

from bot.config import settings
from bot.services.parser import ParsedItem


def open_app_keyboard(chat_type: str, bot_username: str | None) -> InlineKeyboardMarkup | None:
    """Build the «🛒 Открыть список» keyboard appropriate for the chat type.

    Telegram restricts inline `web_app` buttons to private chats; sending one
    in a group makes the whole `sendMessage` call fail. In groups we fall back
    to a `url=` direct-link Mini App (`t.me/<bot_username>/<WEBAPP_SHORT_NAME>`).
    Returns None when the relevant config is missing — caller passes it to
    `reply_markup`, which keeps the message itself sendable.
    """
    if chat_type == "private" and settings.WEBAPP_URL:
        return InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(
                text="🛒 Открыть список",
                web_app=WebAppInfo(url=settings.WEBAPP_URL),
            ),
        ]])
    if bot_username and settings.WEBAPP_SHORT_NAME:
        url = f"https://t.me/{bot_username}/{settings.WEBAPP_SHORT_NAME}"
        return InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="🛒 Открыть список", url=url),
        ]])
    return None


def format_added(items: Iterable[ParsedItem] | list[str], count: int) -> str:
    if count == 0:
        return "Не нашёл товаров в сообщении 🤔"
    word = _plural(count, ("товар", "товара", "товаров"))
    return f"✓ Добавил {count} {word}"


def _plural(n: int, forms: tuple[str, str, str]) -> str:
    n = abs(n) % 100
    n1 = n % 10
    if 10 < n < 20:
        return forms[2]
    if 1 < n1 < 5:
        return forms[1]
    if n1 == 1:
        return forms[0]
    return forms[2]
