import logging

from aiogram import F, Router
from aiogram.types import Message

from bot.db.store import connect
from bot.handlers._common import format_added, open_app_keyboard
from bot.services.parser import parse_text
from bot.services.shopping import add_items


router = Router()
logger = logging.getLogger(__name__)


@router.message(F.text & ~F.text.startswith("/"))
async def on_text(message: Message) -> None:
    text = (message.text or "").strip()
    if not text:
        return

    notice = await message.reply("📝 Разбираю…")

    try:
        parsed = await parse_text(text)
    except Exception:
        logger.exception("Text parse failed")
        await notice.edit_text("Не получилось разобрать. Попробуй ещё раз.")
        return

    if not parsed:
        await notice.edit_text(format_added([], 0))
        return

    async with connect() as db:
        _, names = await add_items(db, parsed, message.from_user.id)

    me = await message.bot.me()
    await notice.edit_text(
        format_added(names, len(names)),
        reply_markup=open_app_keyboard(message.chat.type, me.username),
    )
