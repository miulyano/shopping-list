from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

from bot.config import settings


def open_app_keyboard(
    chat_type: str,
    bot_username: str | None,
    list_key: str | None = None,
) -> InlineKeyboardMarkup | None:
    """Build the «🛒 Список» keyboard appropriate for the chat type.

    Telegram restricts inline `web_app` buttons to private chats; sending one
    in a group makes the whole `sendMessage` call fail. In groups we fall back
    to a `url=` direct-link Mini App (`t.me/<bot_username>/<WEBAPP_SHORT_NAME>`).
    Returns None when the relevant config is missing — caller passes it to
    `reply_markup`, which keeps the message itself sendable.

    When `list_key` is given, the link deep-links into that named list:
    `#list=<key>` on the web_app URL, `?startapp=list-<key>` on the group link.
    """
    if chat_type == "private" and settings.WEBAPP_URL:
        url = settings.WEBAPP_URL
        if list_key:
            url = f"{url}#list={list_key}"
        return InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(
                text="🛒 Список",
                web_app=WebAppInfo(url=url),
            ),
        ]])
    if bot_username and settings.WEBAPP_SHORT_NAME:
        url = f"https://t.me/{bot_username}/{settings.WEBAPP_SHORT_NAME}"
        if list_key:
            url = f"{url}?startapp=list-{list_key}"
        return InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="🛒 Список", url=url),
        ]])
    return None


def format_added(
    count: int,
    list_name: str | None = None,
    unresolved: bool = False,
) -> str:
    if count == 0:
        return "Не нашёл товаров в сообщении 🤔"
    word = plural_ru(count, ("товар", "товара", "товаров"))
    line = f"✓ Добавил {count} {word}"
    if list_name:
        line += f" в список «{list_name}»"
    if unresolved:
        line += "\n⚠️ Не распознал, в какой список — положил в «Общее»."
    return line


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


def success_status(
    names: list[str],
    list_name: str | None = None,
    unresolved: bool = False,
) -> tuple[str, str | None]:
    """Title + sub for the Mini App success banner."""
    if not names:
        return ("Ничего не добавлено", None)
    word = plural_ru(len(names), ("товар", "товара", "товаров"))
    title = f"Добавлено {len(names)} {word}"
    if list_name:
        title += f" в «{list_name}»"
    sub = ", ".join(names)
    if unresolved:
        sub = "⚠️ Не распознал список — положил в «Общее». " + sub
    return (title, sub)
