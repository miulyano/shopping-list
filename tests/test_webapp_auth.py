import hashlib
import hmac
from urllib.parse import urlencode

from webapp.auth import validate_init_data


BOT_TOKEN = "1234:abc"


def _sign(params: dict) -> str:
    data_check = "\n".join(f"{k}={v}" for k, v in sorted(params.items()))
    secret = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
    h = hmac.new(secret, data_check.encode(), hashlib.sha256).hexdigest()
    return urlencode({**params, "hash": h})


def test_valid_init_data_extracts_user():
    init_data = _sign({
        "auth_date": "1700000000",
        "user": '{"id":111,"first_name":"Test"}',
    })
    info = validate_init_data(init_data, BOT_TOKEN)
    assert info is not None
    assert info["user_id"] == 111


def test_tampered_hash_rejected():
    init_data = _sign({"auth_date": "1700000000", "user": '{"id":111}'})
    bad = init_data.replace("hash=", "hash=ff")
    assert validate_init_data(bad, BOT_TOKEN) is None


def test_empty_returns_none():
    assert validate_init_data("", BOT_TOKEN) is None


def test_missing_hash_returns_none():
    assert validate_init_data("auth_date=1&user=%7B%7D", BOT_TOKEN) is None
