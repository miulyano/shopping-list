import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from bot.services.parser import normalize_category, normalize_qty, parse_text


@pytest.mark.parametrize(
    "raw, expected",
    [
        (None, None),
        ("", None),
        ("   ", None),
        ("null", None),
        ("NULL", None),
        ("Null", None),
        ("none", None),
        ("None", None),
        ("nan", None),
        ("-", None),
        ("—", None),
        ("–", None),
        ("  null  ", None),
        ("1 л", "1 л"),
        (" 200 г ", "200 г"),
        ("5 шт", "5 шт"),
        ("0.5 кг", "0.5 кг"),
    ],
)
def test_normalize_qty(raw, expected):
    assert normalize_qty(raw) == expected


@pytest.mark.asyncio
async def test_parse_text_strips_literal_null_string():
    """GPT sometimes returns the string "null" instead of JSON null — must collapse to None."""
    response = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps({"items": [
            {"name": "Хлеб", "qty": "null", "brands": []},
            {"name": "Молоко", "qty": "None", "brands": []},
        ]})))]
    )
    fake_client = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=AsyncMock(return_value=response)))
    )
    with patch("bot.services.parser.get_client", return_value=fake_client):
        result, _hint = await parse_text("хлеб, молоко")
    assert [i.qty for i in result] == [None, None]


def _mk_response(items: list[dict], list_hint=None) -> SimpleNamespace:
    payload: dict = {"items": items}
    if list_hint is not None:
        payload["list_hint"] = list_hint
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(payload)))]
    )


@pytest.mark.asyncio
async def test_parse_text_extracts_list_hint():
    response = _mk_response([{"name": "Сыр", "qty": None, "brands": []}], list_hint="Таты")
    fake_client = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=AsyncMock(return_value=response)))
    )
    with patch("bot.services.parser.get_client", return_value=fake_client):
        items, hint = await parse_text("для Таты сыр", ["Общее", "Тата", "Максим"])
    assert [i.name for i in items] == ["сыр"]
    assert hint == "Таты"


@pytest.mark.asyncio
async def test_parse_text_no_list_hint_is_none():
    response = _mk_response([{"name": "Сыр", "qty": None, "brands": []}])
    fake_client = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=AsyncMock(return_value=response)))
    )
    with patch("bot.services.parser.get_client", return_value=fake_client):
        _items, hint = await parse_text("сыр")
    assert hint is None


@pytest.mark.asyncio
async def test_parse_empty_text_short_circuits():
    with patch("bot.services.parser.get_client") as mock_client:
        result, _hint = await parse_text("   ")
    assert result == []
    mock_client.assert_not_called()


@pytest.mark.asyncio
async def test_parse_text_returns_items():
    response = _mk_response([
        {"name": "Молоко", "qty": "1 л", "brands": []},
        {"name": "Хлеб", "qty": None, "brands": []},
    ])
    fake_client = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=AsyncMock(return_value=response)))
    )
    with patch("bot.services.parser.get_client", return_value=fake_client):
        result, _hint = await parse_text("молоко 1 л, хлеб")
    assert [i.name for i in result] == ["молоко", "хлеб"]
    assert result[0].qty == "1 л"
    assert result[1].qty is None


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("food", "food"),
        ("home", "home"),
        ("care", "care"),
        (" HOME ", "home"),
        ("Care", "care"),
        ("groceries", "food"),  # unknown → default
        (None, "food"),
        ("", "food"),
        (123, "food"),
    ],
)
def test_normalize_category(raw, expected):
    assert normalize_category(raw) == expected


@pytest.mark.asyncio
async def test_parse_text_assigns_category():
    response = _mk_response([
        {"name": "Молоко", "qty": "1 л", "brands": [], "category": "food"},
        {"name": "Стиральный порошок", "qty": None, "brands": [], "category": "home"},
        {"name": "Зубная паста", "qty": None, "brands": [], "category": "care"},
    ])
    fake_client = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=AsyncMock(return_value=response)))
    )
    with patch("bot.services.parser.get_client", return_value=fake_client):
        result, _hint = await parse_text("молоко, порошок, зубная паста")
    assert [i.category for i in result] == ["food", "home", "care"]


@pytest.mark.asyncio
async def test_parse_text_invalid_category_falls_back_to_food():
    response = _mk_response([
        {"name": "Молоко", "qty": None, "brands": [], "category": "groceries"},
        {"name": "Хлеб", "qty": None, "brands": []},  # category missing entirely
    ])
    fake_client = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=AsyncMock(return_value=response)))
    )
    with patch("bot.services.parser.get_client", return_value=fake_client):
        result, _hint = await parse_text("молоко, хлеб")
    assert [i.category for i in result] == ["food", "food"]


@pytest.mark.asyncio
async def test_parse_text_filters_empty_names():
    response = _mk_response([
        {"name": "  ", "qty": None, "brands": []},
        {"name": "Сыр", "qty": "200 г", "brands": []},
    ])
    fake_client = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=AsyncMock(return_value=response)))
    )
    with patch("bot.services.parser.get_client", return_value=fake_client):
        result, _hint = await parse_text("сыр 200г")
    assert [i.name for i in result] == ["сыр"]


@pytest.mark.asyncio
async def test_parse_text_returns_non_food_items():
    """Parser must pass through any items the LLM returns — including non-food
    (household, electronics, hardware). There is no category filter downstream."""
    response = _mk_response([
        {"name": "Фольга", "qty": None, "brands": []},
        {"name": "Батарейки AA", "qty": "4 шт", "brands": []},
        {"name": "Наушники", "qty": None, "brands": []},
        {"name": "Шурупы", "qty": "50 шт", "brands": []},
    ])
    fake_client = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=AsyncMock(return_value=response)))
    )
    with patch("bot.services.parser.get_client", return_value=fake_client):
        result, _hint = await parse_text("фольга, батарейки 4, наушники, шурупы 50")
    assert [i.name for i in result] == ["фольга", "батарейки aa", "наушники", "шурупы"]
    assert [i.qty for i in result] == [None, "4 шт", None, "50 шт"]


@pytest.mark.asyncio
async def test_parse_text_preserves_brand_case():
    """Brand tokens keep their canonical case; everything else lowercased."""
    response = _mk_response([
        {"name": "Молоко Простоквашино 2.5%", "qty": "1 л", "brands": ["Простоквашино"]},
        {"name": "Coca-Cola", "qty": "2 шт", "brands": ["Coca-Cola"]},
        {"name": "iPhone 15 Pro", "qty": None, "brands": ["iPhone"]},
    ])
    fake_client = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=AsyncMock(return_value=response)))
    )
    with patch("bot.services.parser.get_client", return_value=fake_client):
        result, _hint = await parse_text("молоко простоквашино, coca-cola 2 шт, iphone")
    assert [i.name for i in result] == [
        "молоко Простоквашино 2.5%",
        "Coca-Cola",
        "iPhone 15 pro",
    ]
    assert [i.brands for i in result] == [["Простоквашино"], ["Coca-Cola"], ["iPhone"]]


@pytest.mark.asyncio
async def test_parse_text_dedupes_exact_duplicates():
    """LLM иногда возвращает одну позицию несколько раз — схлопываем."""
    response = _mk_response([
        {"name": "Яблоки", "qty": None, "brands": []},
        {"name": "Бананы", "qty": None, "brands": []},
        {"name": "Яблоки", "qty": None, "brands": []},
        {"name": "Бананы", "qty": None, "brands": []},
    ])
    fake_client = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=AsyncMock(return_value=response)))
    )
    with patch("bot.services.parser.get_client", return_value=fake_client):
        result, _hint = await parse_text("Яблоки бананы")
    assert [i.name for i in result] == ["яблоки", "бананы"]


@pytest.mark.asyncio
async def test_parse_text_keeps_same_name_different_qty():
    """Одно имя + разный qty — это две легитимные позиции, не дубль."""
    response = _mk_response([
        {"name": "Молоко", "qty": "1 л", "brands": []},
        {"name": "Молоко", "qty": "2 л", "brands": []},
    ])
    fake_client = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=AsyncMock(return_value=response)))
    )
    with patch("bot.services.parser.get_client", return_value=fake_client):
        result, _hint = await parse_text("молоко 1л, молоко 2л")
    assert [(i.name, i.qty) for i in result] == [("молоко", "1 л"), ("молоко", "2 л")]


@pytest.mark.asyncio
async def test_parse_text_handles_bad_json():
    bad = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="not json"))])
    fake_client = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=AsyncMock(return_value=bad)))
    )
    with patch("bot.services.parser.get_client", return_value=fake_client):
        result, _hint = await parse_text("молоко")
    assert result == []
