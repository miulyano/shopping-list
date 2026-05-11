from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

from bot.config import settings


def open_app_keyboard(chat_type: str, bot_username: str | None) -> InlineKeyboardMarkup | None:
    """Build the «🛒 Список» keyboard appropriate for the chat type.

    Telegram restricts inline `web_app` buttons to private chats; sending one
    in a group makes the whole `sendMessage` call fail. In groups we fall back
    to a `url=` direct-link Mini App (`t.me/<bot_username>/<WEBAPP_SHORT_NAME>`).
    Returns None when the relevant config is missing — caller passes it to
    `reply_markup`, which keeps the message itself sendable.
    """
    if chat_type == "private" and settings.WEBAPP_URL:
        return InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(
                text="🛒 Список",
                web_app=WebAppInfo(url=settings.WEBAPP_URL),
            ),
        ]])
    if bot_username and settings.WEBAPP_SHORT_NAME:
        url = f"https://t.me/{bot_username}/{settings.WEBAPP_SHORT_NAME}"
        return InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="🛒 Список", url=url),
        ]])
    return None


def format_added(count: int) -> str:
    if count == 0:
        return "Не нашёл товаров в сообщении 🤔"
    word = plural_ru(count, ("товар", "товара", "товаров"))
    return f"✓ Добавил {count} {word}"


def plural_ru(n: int, forms: tuple[str, str, str]) -> str:
    n = abs(n) % 100
    n1 = n % 10
    if 10 < n < 20:
        return forms[2]
    if 1 < n1 < 5:
        return forms[1]
    if n1 == 1:
        return forms[0]
    return forms[2]


def success_status(names: list[str]) -> tuple[str, str | None]:
    """Title + sub for the Mini App success banner."""
    if not names:
        return ("Ничего не добавлено", None)
    word = plural_ru(len(names), ("товар", "товара", "товаров"))
    return (f"Добавлено {len(names)} {word}", ", ".join(names))
