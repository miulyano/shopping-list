import logging
import os
import uuid
from pathlib import Path

from aiogram import F, Router
from aiogram.types import Message

from bot.config import settings
from bot.db.store import connect
from bot.handlers._common import format_added, open_app_keyboard
from bot.services.media import to_mp3_16k_mono
from bot.services.parser import parse_text
from bot.services.shopping import add_items
from bot.services.transcriber import transcribe_audio


router = Router()
logger = logging.getLogger(__name__)


@router.message(F.voice | F.audio)
async def on_voice(message: Message) -> None:
    notice = await message.reply("🎙 Слушаю...")

    voice = message.voice or message.audio
    if voice is None:
        return

    Path(settings.TEMP_DIR).mkdir(parents=True, exist_ok=True)
    uid = uuid.uuid4().hex
    raw_path = os.path.join(settings.TEMP_DIR, f"{uid}.ogg")
    mp3_path = os.path.join(settings.TEMP_DIR, f"{uid}.mp3")

    try:
        await message.bot.download(voice.file_id, destination=raw_path)
        await to_mp3_16k_mono(raw_path, mp3_path)
        text = await transcribe_audio(mp3_path)
    except Exception:
        logger.exception("Voice processing failed")
        await notice.edit_text("Не удалось распознать голосовое.")
        return
    finally:
        for p in (raw_path, mp3_path):
            try:
                os.unlink(p)
            except FileNotFoundError:
                pass

    if not text:
        await notice.edit_text("В голосовом ничего не разобрал.")
        return

    try:
        parsed = await parse_text(text)
    except Exception:
        logger.exception("Voice text parse failed")
        await notice.edit_text("Не получилось разобрать список из голосового.")
        return

    if not parsed:
        await notice.edit_text(f"📝 «{text}»\n\n{format_added([], 0)}")
        return

    async with connect() as db:
        _, names = await add_items(db, parsed, message.from_user.id)

    me = await message.bot.me()
    await notice.edit_text(
        f"📝 «{text}»\n\n{format_added(names, len(names))}",
        reply_markup=open_app_keyboard(message.chat.type, me.username),
    )
