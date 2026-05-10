from functools import lru_cache

from openai import AsyncOpenAI

from bot.config import settings


@lru_cache(maxsize=1)
def get_client() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
