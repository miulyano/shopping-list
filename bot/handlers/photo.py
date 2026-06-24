import logging
import os
import uuid
from pathlib import Path

from aiogram import F, Router
from aiogram.types import Message

from bot.config import settings
from bot.db.store import connect
from bot.handlers._common import format_added, open_app_keyboard, success_status
from bot.services import ingest_state
from bot.services.notify import notify_items_added
from bot.services.shopping import (
    add_items,
    default_named_list,
    match_named_list_in_text,
)
from bot.services.vision import parse_image


router = Router()
logger = logging.getLogger(__name__)


@router.message(F.photo)
async def on_photo(message: Message) -> None:
    notice = await message.reply("📷 Распознаю фото...")

    if not message.photo:
        return
    photo = message.photo[-1]  # largest

    async with connect() as db:
        event_id = await ingest_state.start(
            db, message.from_user.id, "photo",
            "Анализирую фото…", "распознаю текст и продукты",
        )

    Path(settings.TEMP_DIR).mkdir(parents=True, exist_ok=True)
    img_path = os.path.join(settings.TEMP_DIR, f"{uuid.uuid4().hex}.jpg")

    try:
        await message.bot.download(photo.file_id, destination=img_path)
        parsed = await parse_image(img_path)
    except Exception:
        logger.exception("Photo processing failed")
        async with connect() as db:
            await ingest_state.finish_error(db, event_id, "Не удалось распознать фото")
        await notice.edit_text("Не удалось распознать фото.")
        return
    finally:
        try:
            os.unlink(img_path)
        except FileNotFoundError:
            pass

    if not parsed:
        async with connect() as db:
            await ingest_state.finish_success(
                db, event_id, [], "Ничего не нашёл на фото", None,
            )
        await notice.edit_text(format_added(0))
        return

    async with connect() as db:
        # Photo caption is the only place a target list can be named here.
        target = await match_named_list_in_text(db, message.caption)
        if target is None:
            target = await default_named_list(db)
        list_id_target = target.id if target else None
        _, names = await add_items(db, parsed, message.from_user.id, list_id_target)
        added = [{"name": p.name, "qty": p.qty} for p in parsed if p.name.strip()]
        list_name = target.name if target else None
        list_key = target.key if target else None
        title, sub = success_status(names, list_name)
        await ingest_state.finish_success(db, event_id, added, title, sub)

    me = await message.bot.me()
    await notice.edit_text(
        format_added(len(names), list_name),
        reply_markup=open_app_keyboard(message.chat.type, me.username, list_key),
    )

    if names:
        await notify_items_added(
            message.bot, message.from_user, message.chat.type, names,
            list_name=list_name, list_key=list_key,
        )
