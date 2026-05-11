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
    "единицу по контексту самого продукта:\n"
    "  - жидкости (молоко, вода, сок, кефир, растительное масло, пиво, вино) → л или мл;\n"
    "  - сыпучие и весовые (мука, сахар, соль, крупа, мясо, рыба, сыр, фарш, овощи на вес) → г или кг;\n"
    "  - штучные (яблоки, бананы, яйца, хлеб, лимоны, огурцы, помидоры) → шт;\n"
    "  - упаковки (макароны, печенье, чипсы, йогурт, конфеты в коробке) → уп.\n"
    "Выбирай единицу по здравому смыслу: «молоко 1» → 1 л, «сахар 1» → 1 кг, "
    "«сахар 500» → 500 г, «яблоки 5» → 5 шт. "
    "Если единица указана явно — не меняй её. "
    "Если контекста для выбора единицы недостаточно — оставь число как есть."
)


SYSTEM_PROMPT = (
    "Ты помогаешь собирать список покупок. "
    "Извлеки из сообщения пользователя список товаров. "
    "Каждый товар — отдельная позиция. "
    "Если в тексте указано количество (вес, штук, литры) — положи его в поле qty строкой как пользователь сказал, "
    "иначе qty = null. "
    "Не добавляй ничего, чего нет в тексте. "
    "Не выдумывай. Если в сообщении нет товаров — верни пустой список.\n"
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
