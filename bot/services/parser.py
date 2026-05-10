from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Optional

from bot.config import settings
from bot.services.openai_client import get_client


logger = logging.getLogger(__name__)


@dataclass
class ParsedItem:
    name: str
    qty: Optional[str] = None


SYSTEM_PROMPT = (
    "Ты помогаешь собирать список покупок. "
    "Извлеки из сообщения пользователя список товаров. "
    "Каждый товар — отдельная позиция. "
    "Если в тексте указано количество (вес, штук, литры) — положи его в поле qty строкой как пользователь сказал, "
    "иначе qty = null. "
    "Не добавляй ничего, чего нет в тексте. "
    "Не выдумывай. Если в сообщении нет товаров — верни пустой список."
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
        out.append(ParsedItem(name=name, qty=(i.get("qty") or None)))
    return out
