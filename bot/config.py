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
    WHISPER_MODEL: str = "gpt-4o-mini-transcribe"
    WHISPER_LANGUAGE: Optional[str] = "ru"
    WHISPER_PROMPT: Optional[str] = (
        "Список покупок для дома и семьи. Возможные товары: "
        "семена чиа, киноа, булгур, кускус, тахини, мисо, тофу, эдамаме, нори, "
        "куркума, кориандр, паприка, зира, кардамон, корица, базилик, орегано, "
        "фольга, пергамент, пищевая плёнка, бумажные полотенца, влажные салфетки, "
        "мешки для мусора, стиральный порошок, кондиционер для белья, "
        "средство для мытья посуды, освежитель воздуха, "
        "зубная паста, шампунь, гель для душа, дезодорант, бритвенные станки, "
        "лампочки, батарейки, удлинитель, наушники, кабель, зарядка, "
        "изолента, скотч, герметик, шурупы, дюбели, гвозди, кисть, валик, "
        "подгузники, корм для кошек, корм для собак, наполнитель для кошачьего туалета."
    )

    @cached_property
    def allowed_user_ids(self) -> list[int]:
        return [int(uid.strip()) for uid in self.ALLOWED_USER_IDS.split(",") if uid.strip()]


settings = Settings()
