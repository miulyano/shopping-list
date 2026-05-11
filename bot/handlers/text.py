import logging

from aiogram import F, Router
from aiogram.types import Message

from bot.db.store import connect
from bot.handlers._common import format_added, open_app_keyboard, success_status
from bot.services import ingest_state
from bot.services.parser import parse_text
from bot.services.shopping import add_items


router = Router()
logger = logging.getLogger(__name__)


def _preview(text: str, limit: int = 60) -> str:
    return text if len(text) <= limit else text[: limit - 1] + "…"


@router.message(F.text & ~F.text.startswith("/"))
async def on_text(message: Message) -> None:
    text = (message.text or "").strip()
    if not text:
        return

    notice = await message.reply("📝 Разбираю…")
    preview = _preview(text)

    async with connect() as db:
        event_id = await ingest_state.start(
            db, message.from_user.id, "text",
            "Разбираю сообщение…", preview,
        )

    try:
        parsed = await parse_text(text)
    except Exception:
        logger.exception("Text parse failed")
        async with connect() as db:
            await ingest_state.finish_error(
                db, event_id, "Не удалось разобрать сообщение", preview,
            )
        await notice.edit_text("Не получилось разобрать. Попробуй ещё раз.")
        return

    if not parsed:
        async with connect() as db:
            await ingest_state.finish_success(
                db, event_id, [], "Ничего не добавлено", preview,
            )
        await notice.edit_text(format_added(0))
        return

    async with connect() as db:
        _, names = await add_items(db, parsed, message.from_user.id)
        added = [{"name": p.name, "qty": p.qty} for p in parsed if p.name.strip()]
        title, sub = success_status(names)
        await ingest_state.finish_success(db, event_id, added, title, sub)

    me = await message.bot.me()
    await notice.edit_text(
        format_added(len(names)),
        reply_markup=open_app_keyboard(message.chat.type, me.username),
    )
