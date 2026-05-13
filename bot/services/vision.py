from __future__ import annotations

import base64
import json
import logging
from pathlib import Path

from bot.config import settings
from bot.services.name_format import format_item_name
from bot.services.openai_client import get_client
from bot.services.parser import (
    CONTEXT_UNIT_INSTRUCTIONS,
    JSON_SCHEMA,
    ParsedItem,
    normalize_qty,
)


logger = logging.getLogger(__name__)


SYSTEM_PROMPT = (
    "На фото — источник списка покупок. Это может быть чек из магазина, продукты на полке/в холодильнике "
    "или рукописная записка. "
    "Извлеки все товары/продукты. Каждый — отдельная позиция. "
    "Если на фото есть количество/вес/объём — положи в qty строкой, иначе qty = null. "
    "Игнорируй цены, итоги, скидки, реквизиты магазина. "
    "Не выдумывай товары, которых нет на фото.\n"
    "\n"
    "Для каждого товара верни поле `brands` — массив строк с названиями брендов "
    "или торговых марок, если они видны на фото или в названии (например, "
    "`Coca-Cola`, `iPhone`, `Простоквашино`, `Nestlé`). Каждый бренд пиши точно в той "
    "форме, в которой он реально пишется. Если бренда нет — пустой массив `[]`. "
    "Не считай брендом нарицательные слова. Каждая строка в `brands` должна реально "
    "встречаться в поле `name` той же позиции.\n"
    "\n"
    + CONTEXT_UNIT_INSTRUCTIONS
)


async def parse_image(image_path: str) -> list[ParsedItem]:
    data = Path(image_path).read_bytes()
    b64 = base64.b64encode(data).decode("ascii")
    suffix = Path(image_path).suffix.lower().lstrip(".") or "jpeg"
    mime = "jpeg" if suffix in ("jpg", "jpeg") else suffix
    data_url = f"data:image/{mime};base64,{b64}"

    client = get_client()
    resp = await client.chat.completions.create(
        model=settings.VISION_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Извлеки список покупок с этого фото."},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            },
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {"name": "shopping_items", "schema": JSON_SCHEMA, "strict": True},
        },
        temperature=0,
    )
    raw = resp.choices[0].message.content or "{}"
    try:
        out = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Vision returned non-JSON: %r", raw)
        return []
    items: list[ParsedItem] = []
    for i in out.get("items", []):
        name = (i.get("name") or "").strip()
        if not name:
            continue
        brands_raw = i.get("brands") or []
        brands = [b for b in (str(x).strip() for x in brands_raw) if b]
        formatted = format_item_name(name, brands)
        if not formatted:
            continue
        items.append(ParsedItem(name=formatted, qty=normalize_qty(i.get("qty")), brands=brands))
    return items
