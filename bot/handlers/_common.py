from typing import Iterable

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

from bot.config import settings
from bot.services.parser import ParsedItem


def open_app_keyboard() -> InlineKeyboardMarkup | None:
    if not settings.WEBAPP_URL:
        return None
    return InlineKeyboardMarkup(
        inline_keyboard=[[
            InlineKeyboardButton(text="🛒 Открыть список", web_app=WebAppInfo(url=settings.WEBAPP_URL)),
        ]]
    )


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
