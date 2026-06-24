from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any, Optional

from bot.config import settings
from bot.services.name_format import format_item_name
from bot.services.openai_client import get_client


logger = logging.getLogger(__name__)


_EMPTY_QTY_MARKERS = {"", "null", "none", "nan", "-", "—", "–"}


def normalize_qty(value: Any) -> Optional[str]:
    """Map AI/user qty value to a clean string or None.

    GPT sometimes returns the literal string "null" / "None" instead of JSON
    null; whitespace-only and dash-only values are equally empty. Anything
    truly empty collapses to None so the Mini App can hide the qty span
    entirely (`{item.qty && …}` guard relies on JS falsy).
    """
    if value is None:
        return None
    if not isinstance(value, str):
        value = str(value)
    stripped = value.strip()
    if stripped.casefold() in _EMPTY_QTY_MARKERS:
        return None
    return stripped


def normalize_category(value: Any) -> str:
    """Map an AI category value to a known key, falling back to DEFAULT_CATEGORY."""
    if isinstance(value, str) and value.strip().casefold() in CATEGORIES:
        return value.strip().casefold()
    return DEFAULT_CATEGORY


# Fixed category taxonomy. Each parsed item is assigned exactly one key; the
# Mini App groups the list by these. Keep in sync with the frontend CATEGORIES
# (webapp/frontend/src/lib/categories.ts).
CATEGORIES = ("food", "home", "care")
DEFAULT_CATEGORY = "food"


@dataclass
class ParsedItem:
    name: str
    qty: Optional[str] = None
    brands: list[str] = field(default_factory=list)
    category: str = DEFAULT_CATEGORY


CONTEXT_UNIT_INSTRUCTIONS = (
    "Если указано только число без единицы измерения — добавь подходящую "
    "единицу по контексту самого товара:\n"
    "  - жидкости (молоко, вода, сок, кефир, растительное масло, пиво, вино) → л или мл;\n"
    "  - сыпучие и весовые (мука, сахар, соль, крупа, мясо, рыба, сыр, фарш, овощи на вес) → г или кг;\n"
    "  - штучные продукты (яблоки, бананы, яйца, хлеб, лимоны, огурцы, помидоры) → шт;\n"
    "  - упаковки/коробки/пачки продуктов (макароны, печенье, чипсы, йогурт, конфеты в коробке) → уп;\n"
    "  - штучные не-продукты (батарейки, лампочки, наушники, кабели, зубные щётки, бритвы, "
    "контейнеры, шурупы, гвозди, дюбели) → шт;\n"
    "  - расходники в упаковках/рулонах (фольга, пергамент, пищевая плёнка, салфетки, "
    "бумажные полотенца, туалетная бумага, мешки для мусора, стиральный порошок) → уп "
    "(или «рулон»/«пачка», если так естественнее).\n"
    "Выбирай единицу по здравому смыслу: «молоко 1» → 1 л, «сахар 1» → 1 кг, "
    "«сахар 500» → 500 г, «яблоки 5» → 5 шт, «батарейки 4» → 4 шт. "
    "Если единица указана явно — не меняй её. "
    "Для бытовой техники и электроники, где штучность очевидна и число не указано, "
    "оставь qty = null. "
    "Если контекста для выбора единицы недостаточно — оставь число как есть."
)


CATEGORY_INSTRUCTIONS = (
    "Для каждого товара верни поле `category` — одну из трёх категорий:\n"
    "  - `food` — продукты и напитки (еда, вода, соки, кофе, чай, алкоголь, "
    "корм для животных, детское питание);\n"
    "  - `home` — бытовые и хозяйственные товары: бытовая химия и расходники для дома "
    "(средство для посуды, стиральный порошок, мешки для мусора, фольга, салфетки, "
    "губки), посуда и кухонная утварь, лампочки, батарейки, инструменты, строительные "
    "и хозтовары, текстиль, товары для дома;\n"
    "  - `care` — гигиена и косметика (зубная паста, шампунь, мыло, гель для душа, "
    "дезодорант, бритвы, прокладки, ватные диски, крем, декоративная косметика).\n"
    "Если товар не подходит явно ни к home, ни к care — ставь `food`. "
    "Поле `category` обязательно для каждой позиции."
)


LIST_HINT_INSTRUCTIONS = (
    "Верни также top-level поле `list_hint` — в какой именованный список покупок "
    "пользователь просит добавить товары, если это явно указано в сообщении "
    "(например «для Таты», «Максиму», «в список дача», «купи домой»). "
    "Положи в `list_hint` само упоминание адресата/списка в той форме, как в тексте "
    "(одно слово, можно в исходном падеже). Если адресат/список НЕ указан явно — "
    "верни `list_hint` = null. Не путай адресата с товаром."
)


def _list_hint_context(list_names: Optional[list[str]]) -> str:
    if not list_names:
        return ""
    names = ", ".join(f"«{n}»" for n in list_names)
    return (
        f"\n\nДоступные списки: {names}. "
        "Если упомянутый адресат похож на один из них — верни его в `list_hint`."
    )


SYSTEM_PROMPT = (
    "Ты помогаешь собирать список покупок для дома и семьи. "
    "Извлеки из сообщения пользователя список товаров, которые он хочет купить.\n"
    "\n"
    "Товаром считается ЛЮБОЙ предмет, расходник или устройство, которое в принципе "
    "продаётся в супермаркетах, на маркетплейсах, в сервисах доставки или онлайн-магазинах "
    "для дома и семьи. Не сужай определение до продуктов питания. К товарам относятся, "
    "например (это иллюстрация, а не закрытый список):\n"
    "  - продукты и напитки;\n"
    "  - бытовая химия и расходники для дома (фольга, пергамент, пищевая плёнка, салфетки, "
    "бумажные полотенца, мешки для мусора, средство для мытья посуды, стиральный порошок, "
    "кондиционер для белья, освежители);\n"
    "  - средства гигиены и косметика (зубная паста, шампунь, мыло, бритвы, прокладки, дезодорант);\n"
    "  - товары для кухни и дома (посуда, контейнеры, лампочки, батарейки, удлинители, текстиль);\n"
    "  - бытовая техника и электроника (чайник, фен, наушники, кабели, зарядки, мелкая техника);\n"
    "  - строительные, ремонтные и хозтовары (краска, кисти, валики, шурупы, гвозди, скотч, "
    "изолента, герметик, сантехнические расходники, инструменты);\n"
    "  - корм и аксессуары для животных;\n"
    "  - одежда, обувь, аксессуары;\n"
    "  - детские товары (подгузники, пюре, игрушки);\n"
    "  - канцелярия, садовые товары, авто-аксессуары.\n"
    "Главный сигнал: если предмет можно положить в корзину онлайн-магазина или супермаркета — "
    "это товар. Если пользователь прислал одно слово-существительное, обозначающее предмет "
    "(«Фольга», «Лампочка», «Батарейки», «Наушники») — это товар, добавь его в список.\n"
    "\n"
    "Каждый товар — отдельная позиция. Если в тексте указано количество (вес, штук, литры, "
    "упаковки) — положи его в поле qty строкой как пользователь сказал, иначе qty = null. "
    "Не добавляй ничего, чего нет в тексте. Не выдумывай. "
    "Если сообщение — это болталка, вопрос, приветствие или просто текст без товаров — "
    "верни пустой список.\n"
    "\n"
    "Сообщение могло прийти из голосового распознавания. Если видишь словосочетание, "
    "которое в контексте покупок звучит бессмысленно и почти наверняка является ошибкой STT "
    "(например, «семена чая» → почти наверняка «семена чиа»; «куркуба» → «куркума»; "
    "«кеноа» → «киноа»), — исправь его на правильное название товара. Не исправляй, если "
    "разница неоднозначна или товар в исходной форме сам по себе валиден.\n"
    "\n"
    "Для каждого товара верни поле `brands` — массив строк с названиями брендов "
    "или торговых марок, если они есть в названии. Каждый бренд пиши точно в той форме, "
    "в которой он реально пишется в реальности: `Coca-Cola`, `iPhone`, `AirPods`, "
    "`Простоквашино`, `Nestlé`, `Lay's`, `Milky Way`. Если бренда нет — пустой массив `[]`. "
    "Не считай брендом нарицательные слова (`молоко`, `хлеб`, `яблоки`, `сахар`) даже если "
    "пользователь написал их с заглавной. Каждая строка в `brands` должна реально "
    "встречаться в поле `name` той же позиции — не придумывай брендов, которых нет в тексте.\n"
    "\n"
    + CATEGORY_INSTRUCTIONS
    + "\n\n"
    + CONTEXT_UNIT_INSTRUCTIONS
    + "\n\n"
    + LIST_HINT_INSTRUCTIONS
)

JSON_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "name": {"type": "string"},
                    "qty": {"type": ["string", "null"]},
                    "brands": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "category": {"type": "string", "enum": list(CATEGORIES)},
                },
                "required": ["name", "qty", "brands", "category"],
            },
        },
        "list_hint": {"type": ["string", "null"]},
    },
    "required": ["items", "list_hint"],
}


async def parse_text(
    text: str, list_names: Optional[list[str]] = None
) -> tuple[list[ParsedItem], Optional[str]]:
    """Parse a message into (items, list_hint).

    `list_names` (display names of the available named lists) is woven into the
    prompt so the model can map an addressee to a known list. `list_hint` is the
    raw addressee mention or None when no list was specified.
    """
    if not text.strip():
        return [], None
    client = get_client()
    system_prompt = SYSTEM_PROMPT + _list_hint_context(list_names)
    resp = await client.chat.completions.create(
        model=settings.PARSER_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text},
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {"name": "shopping_items", "schema": JSON_SCHEMA, "strict": True},
        },
        temperature=0,
    )
    raw = resp.choices[0].message.content or "{}"
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Parser returned non-JSON: %r", raw)
        return [], None
    list_hint = data.get("list_hint")
    if isinstance(list_hint, str):
        list_hint = list_hint.strip() or None
    else:
        list_hint = None
    out: list[ParsedItem] = []
    for i in data.get("items", []):
        name = (i.get("name") or "").strip()
        if not name:
            continue
        brands_raw = i.get("brands") or []
        brands = [b for b in (str(x).strip() for x in brands_raw) if b]
        formatted = format_item_name(name, brands)
        if not formatted:
            continue
        out.append(ParsedItem(
            name=formatted,
            qty=normalize_qty(i.get("qty")),
            brands=brands,
            category=normalize_category(i.get("category")),
        ))

    seen: set[tuple[str, Optional[str]]] = set()
    deduped: list[ParsedItem] = []
    for item in out:
        key = (item.name.casefold(), item.qty)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    if len(deduped) != len(out):
        logger.warning(
            "Parser returned %d items, deduped to %d for input %r; raw=%r",
            len(out), len(deduped), text, raw,
        )
    return deduped, list_hint
