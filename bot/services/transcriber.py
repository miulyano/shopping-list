from pathlib import Path

from bot.config import settings
from bot.services.openai_client import get_client


async def transcribe_audio(audio_path: str) -> str:
    """Transcribe audio file via OpenAI Whisper."""
    client = get_client()
    with Path(audio_path).open("rb") as f:
        resp = await client.audio.transcriptions.create(
            model=settings.WHISPER_MODEL,
            file=f,
            language=settings.WHISPER_LANGUAGE or None,
        )
    return (resp.text or "").strip()
