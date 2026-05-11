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
from bot.services.media import to_mp3_16k_mono
from bot.services.parser import parse_text
from bot.services.shopping import add_items
from bot.services.transcriber import transcribe_audio


router = Router()
logger = logging.getLogger(__name__)


def _fmt_duration(seconds: int | None) -> str | None:
    if not seconds:
        return None
    m, s = divmod(int(seconds), 60)
    return f"{m}:{s:02d}"


@router.message(F.voice | F.audio)
async def on_voice(message: Message) -> None:
    notice = await message.reply("🎙 Слушаю...")

    voice = message.voice or message.audio
    if voice is None:
        return

    duration = _fmt_duration(getattr(voice, "duration", None))
    async with connect() as db:
        event_id = await ingest_state.start(
            db, message.from_user.id, "voice",
            "Распознаю голосовое…", duration,
        )

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
        async with connect() as db:
            await ingest_state.finish_error(db, event_id, "Не удалось распознать голосовое")
        await notice.edit_text("Не удалось распознать голосовое.")
        return
    finally:
        for p in (raw_path, mp3_path):
            try:
                os.unlink(p)
            except FileNotFoundError:
                pass

    if not text:
        async with connect() as db:
            await ingest_state.finish_success(
                db, event_id, [], "Ничего не разобрал", None,
            )
        await notice.edit_text("В голосовом ничего не разобрал.")
        return

    transcript_preview = text if len(text) <= 80 else text[:79] + "…"
    async with connect() as db:
        await ingest_state.update(
            db, event_id, "parsing",
            title="Извлекаю товары…", sub=transcript_preview,
        )

    try:
        parsed = await parse_text(text)
    except Exception:
        logger.exception("Voice text parse failed")
        async with connect() as db:
            await ingest_state.finish_error(
                db, event_id, "Не удалось разобрать список", transcript_preview,
            )
        await notice.edit_text("Не получилось разобрать список из голосового.")
        return

    if not parsed:
        async with connect() as db:
            await ingest_state.finish_success(
                db, event_id, [], "Ничего не добавлено", transcript_preview,
            )
        await notice.edit_text(f"📝 «{text}»\n\n{format_added(0)}")
        return

    async with connect() as db:
        _, names = await add_items(db, parsed, message.from_user.id)
        added = [{"name": p.name, "qty": p.qty} for p in parsed if p.name.strip()]
        title, sub = success_status(names)
        await ingest_state.finish_success(db, event_id, added, title, sub)

    me = await message.bot.me()
    await notice.edit_text(
        f"📝 «{text}»\n\n{format_added(len(names))}",
        reply_markup=open_app_keyboard(message.chat.type, me.username),
    )
