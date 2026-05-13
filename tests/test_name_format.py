import pytest

from bot.services.name_format import format_item_name


@pytest.mark.parametrize(
    "raw, brands, expected",
    [
        ("Молоко", [], "молоко"),
        ("Молоко", None, "молоко"),
        ("Молоко Простоквашино 2.5%", ["Простоквашино"], "молоко Простоквашино 2.5%"),
        ("COCA-COLA 1 л", ["Coca-Cola"], "Coca-Cola 1 л"),
        ("купить iphone 15 pro", ["iPhone"], "купить iPhone 15 pro"),
        ("яблоки apple", [], "яблоки apple"),
        ("чипсы lays и pepsi", ["Lay's", "Pepsi"], "чипсы lays и Pepsi"),
        ("   Хлеб   ", [], "хлеб"),
        ("молоко\tпростоквашино", ["Простоквашино"], "молоко Простоквашино"),
        ("AirPods Pro", ["AirPods"], "AirPods pro"),
        ("", [], ""),
        ("   ", [], ""),
        # hallucinated brand that does not occur in the name — silently ignored
        ("сахар 1 кг", ["Nestlé"], "сахар 1 кг"),
        # multi-word brand
        ("шоколад milky way", ["Milky Way"], "шоколад Milky Way"),
        # do not touch substring matches: "apple" should not be capitalized inside "pineapple"
        ("ананас pineapple", ["Apple"], "ананас pineapple"),
    ],
)
def test_format_item_name(raw, brands, expected):
    assert format_item_name(raw, brands) == expected


def test_format_item_name_is_idempotent():
    once = format_item_name("Молоко Простоквашино 2.5%", ["Простоквашино"])
    twice = format_item_name(once, ["Простоквашино"])
    assert once == twice
