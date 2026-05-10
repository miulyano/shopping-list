import logging
import os
import uuid
from pathlib import Path

from aiogram import F, Router
from aiogram.types import Message

from bot.config import settings
from bot.db.store import connect
from bot.handlers._common import format_added, open_app_keyboard
from bot.services.shopping import add_items
from bot.services.vision import parse_image


router = Router()
logger = logging.getLogger(__name__)


@router.message(F.photo)
async def on_photo(message: Message) -> None:
    notice = await message.reply("📷 Распознаю фото...")

    if not message.photo:
        return
    photo = message.photo[-1]  # largest

    Path(settings.TEMP_DIR).mkdir(parents=True, exist_ok=True)
    img_path = os.path.join(settings.TEMP_DIR, f"{uuid.uuid4().hex}.jpg")

    try:
        await message.bot.download(photo.file_id, destination=img_path)
        parsed = await parse_image(img_path)
    except Exception:
        logger.exception("Photo processing failed")
        await notice.edit_text("Не удалось распознать фото.")
        return
    finally:
        try:
            os.unlink(img_path)
        except FileNotFoundError:
            pass

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
