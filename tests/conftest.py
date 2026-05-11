import hashlib
import hmac
import os
from urllib.parse import urlencode

os.environ.setdefault("BOT_TOKEN", "test-bot-token")
os.environ.setdefault("OPENAI_API_KEY", "test-openai-key")
os.environ.setdefault("ALLOWED_USER_IDS", "111,222")
os.environ.setdefault("TARGET_CHAT_ID", "-1001234567890")

import pytest
import pytest_asyncio


def sign_init_data(user_id: int, bot_token: str) -> str:
    params = {
        "auth_date": "1700000000",
        "user": f'{{"id":{user_id},"first_name":"Test"}}',
    }
    data_check = "\n".join(f"{k}={v}" for k, v in sorted(params.items()))
    secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    h = hmac.new(secret, data_check.encode(), hashlib.sha256).hexdigest()
    return urlencode({**params, "hash": h})


@pytest.fixture
def tmp_db_path(tmp_path, monkeypatch):
    db_file = tmp_path / "shopping.db"
    monkeypatch.setattr("bot.config.settings.DB_PATH", str(db_file))
    return str(db_file)


@pytest_asyncio.fixture
async def db(tmp_db_path):
    from bot.db.store import connect, init_db
    await init_db(tmp_db_path)
    async with connect(tmp_db_path) as conn:
        yield conn
