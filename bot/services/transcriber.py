from pathlib import Path

from bot.config import settings
from bot.services.openai_client import get_client


async def transcribe_audio(audio_path: str, extra_prompt: str | None = None) -> str:
    """Transcribe audio file via OpenAI Whisper.

    `extra_prompt` is appended to the static hint — used to feed list names
    (Тата, Максим, …) so the model transcribes them correctly.
    """
    client = get_client()
    kwargs: dict = {
        "model": settings.WHISPER_MODEL,
        "language": settings.WHISPER_LANGUAGE or None,
    }
    prompt = settings.WHISPER_PROMPT or ""
    if extra_prompt:
        prompt = f"{prompt} {extra_prompt}".strip()
    if prompt:
        kwargs["prompt"] = prompt
    with Path(audio_path).open("rb") as f:
        resp = await client.audio.transcriptions.create(file=f, **kwargs)
    return (resp.text or "").strip()
