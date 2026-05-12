from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any, Optional

from bot.config import settings
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


@dataclass
class ParsedItem:
    name: str
    qty: Optional[str] = None


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
    + CONTEXT_UNIT_INSTRUCTIONS
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
                },
                "required": ["name", "qty"],
            },
        }
    },
    "required": ["items"],
}


async def parse_text(text: str) -> list[ParsedItem]:
    if not text.strip():
        return []
    client = get_client()
    resp = await client.chat.completions.create(
        model=settings.PARSER_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
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
        return []
    out: list[ParsedItem] = []
    for i in data.get("items", []):
        name = (i.get("name") or "").strip()
        if not name:
            continue
        out.append(ParsedItem(name=name, qty=normalize_qty(i.get("qty"))))
    return out
