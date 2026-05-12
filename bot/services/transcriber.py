from pathlib import Path

from bot.config import settings
from bot.services.openai_client import get_client


async def transcribe_audio(audio_path: str) -> str:
    """Transcribe audio file via OpenAI Whisper."""
    client = get_client()
    kwargs: dict = {
        "model": settings.WHISPER_MODEL,
        "language": settings.WHISPER_LANGUAGE or None,
    }
    if settings.WHISPER_PROMPT:
        kwargs["prompt"] = settings.WHISPER_PROMPT
    with Path(audio_path).open("rb") as f:
        resp = await client.audio.transcriptions.create(file=f, **kwargs)
    return (resp.text or "").strip()
