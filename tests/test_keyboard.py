import pytest

from bot.config import settings
from bot.handlers._common import open_app_keyboard


@pytest.fixture
def webapp_url(monkeypatch):
    monkeypatch.setattr(settings, "WEBAPP_URL", "https://example.com/app")
    return "https://example.com/app"


@pytest.fixture
def short_name(monkeypatch):
    monkeypatch.setattr(settings, "WEBAPP_SHORT_NAME", "list")
    return "list"


@pytest.fixture
def no_short_name(monkeypatch):
    monkeypatch.setattr(settings, "WEBAPP_SHORT_NAME", None)


@pytest.fixture
def no_webapp_url(monkeypatch):
    monkeypatch.setattr(settings, "WEBAPP_URL", None)


def test_private_chat_uses_web_app_button(webapp_url):
    kb = open_app_keyboard("private", "anybot")
    assert kb is not None
    button = kb.inline_keyboard[0][0]
    assert button.web_app is not None
    assert button.web_app.url == webapp_url
    assert button.url is None


def test_private_chat_without_webapp_url_falls_back_to_direct_link(no_webapp_url, short_name):
    kb = open_app_keyboard("private", "anybot")
    assert kb is not None
    button = kb.inline_keyboard[0][0]
    assert button.web_app is None
    assert button.url == "https://t.me/anybot/list"


def test_private_chat_without_any_config_returns_none(no_webapp_url, no_short_name):
    kb = open_app_keyboard("private", "anybot")
    assert kb is None


def test_group_chat_uses_direct_link_url(webapp_url, short_name):
    kb = open_app_keyboard("supergroup", "shoppingbot")
    assert kb is not None
    button = kb.inline_keyboard[0][0]
    assert button.web_app is None
    assert button.url == "https://t.me/shoppingbot/list"


def test_group_chat_without_short_name_returns_none(webapp_url, no_short_name):
    kb = open_app_keyboard("group", "shoppingbot")
    assert kb is None


def test_group_chat_without_bot_username_returns_none(webapp_url, short_name):
    kb = open_app_keyboard("supergroup", None)
    assert kb is None


def test_private_deep_link_appends_hash(webapp_url):
    kb = open_app_keyboard("private", "anybot", "tata")
    button = kb.inline_keyboard[0][0]
    assert button.web_app.url == "https://example.com/app#list=tata"


def test_group_deep_link_appends_startapp(webapp_url, short_name):
    kb = open_app_keyboard("supergroup", "shoppingbot", "maksim")
    button = kb.inline_keyboard[0][0]
    assert button.url == "https://t.me/shoppingbot/list?startapp=list-maksim"
