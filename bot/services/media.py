from pathlib import Path

from bot.services.ffmpeg_runner import run_ffmpeg


async def to_mp3_16k_mono(input_path: str, output_path: str) -> str:
    """Convert any audio (e.g. .ogg from Telegram voice) to MP3, 16kHz mono."""
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    await run_ffmpeg(
        "-i", input_path,
        "-ac", "1",
        "-ar", "16000",
        "-codec:a", "libmp3lame",
        "-q:a", "5",
        output_path,
    )
    return output_path
