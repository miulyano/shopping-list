import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from bot.services.parser import parse_text


def _mk_response(items: list[dict]) -> SimpleNamespace:
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps({"items": items})))]
    )


@pytest.mark.asyncio
async def test_parse_empty_text_short_circuits():
    with patch("bot.services.parser.get_client") as mock_client:
        result = await parse_text("   ")
    assert result == []
    mock_client.assert_not_called()


@pytest.mark.asyncio
async def test_parse_text_returns_items():
    response = _mk_response([
        {"name": "Молоко", "qty": "1 л"},
        {"name": "Хлеб", "qty": None},
    ])
    fake_client = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=AsyncMock(return_value=response)))
    )
    with patch("bot.services.parser.get_client", return_value=fake_client):
        result = await parse_text("молоко 1 л, хлеб")
    assert [i.name for i in result] == ["Молоко", "Хлеб"]
    assert result[0].qty == "1 л"
    assert result[1].qty is None


@pytest.mark.asyncio
async def test_parse_text_filters_empty_names():
    response = _mk_response([
        {"name": "  ", "qty": None},
        {"name": "Сыр", "qty": "200 г"},
    ])
    fake_client = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=AsyncMock(return_value=response)))
    )
    with patch("bot.services.parser.get_client", return_value=fake_client):
        result = await parse_text("сыр 200г")
    assert [i.name for i in result] == ["Сыр"]


@pytest.mark.asyncio
async def test_parse_text_handles_bad_json():
    bad = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="not json"))])
    fake_client = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=AsyncMock(return_value=bad)))
    )
    with patch("bot.services.parser.get_client", return_value=fake_client):
        result = await parse_text("молоко")
    assert result == []
