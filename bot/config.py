from functools import cached_property
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    BOT_TOKEN: str
    OPENAI_API_KEY: str
    ALLOWED_USER_IDS: str = ""
    TARGET_CHAT_ID: Optional[int] = None
    WEBAPP_URL: Optional[str] = None
    WEBAPP_SHORT_NAME: Optional[str] = None
    DB_PATH: str = "data/shopping.db"
    TEMP_DIR: str = "/tmp/shopping-list"
    LOG_LEVEL: str = "INFO"

    PARSER_MODEL: str = "gpt-4o-mini"
    VISION_MODEL: str = "gpt-4o"
    WHISPER_MODEL: str = "whisper-1"
    WHISPER_LANGUAGE: Optional[str] = "ru"

    @cached_property
    def allowed_user_ids(self) -> list[int]:
        return [int(uid.strip()) for uid in self.ALLOWED_USER_IDS.split(",") if uid.strip()]


settings = Settings()
