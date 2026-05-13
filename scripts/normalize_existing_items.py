"""One-shot migration: re-format every row in `items.name` via the LLM brand
detector + deterministic post-processor.

Usage (run inside the bot container or with a venv that has the bot's deps):

    python scripts/normalize_existing_items.py --dry-run   # preview diff
    python scripts/normalize_existing_items.py             # apply changes

Idempotent: a second run on the same DB is a no-op (already-formatted rows
return the same string and are skipped). Always back up the DB first:

    cp data/shopping.db data/shopping.db.bak.$(date +%s)
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path

# Allow running as `python scripts/normalize_existing_items.py` from repo root.
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import aiosqlite  # noqa: E402

from bot.config import settings  # noqa: E402
from bot.services.name_format import format_item_name  # noqa: E402
from bot.services.openai_client import get_client  # noqa: E402


logger = logging.getLogger("normalize_items")


BATCH_SIZE = 20

PROMPT = (
    "Тебе придёт массив `names` — каждая строка это уже сохранённое название товара "
    "из списка покупок. Для каждой строки верни объект "
    "`{\"name\": <строка-как-есть>, \"brands\": [<список брендов в канонической форме>]}`. "
    "Бренды — это торговые марки (`Coca-Cola`, `iPhone`, `Простоквашино`, `Nestlé`, "
    "`Lay's`). Каждый бренд должен реально встречаться внутри `name` (а не быть "
    "галлюцинацией). Нарицательные слова (`молоко`, `хлеб`, `яблоки`, `сахар`) брендами "
    "не считаются. Если бренда нет — `brands: []`. Поле `name` верни строго таким, как "
    "тебе его прислали (без изменений) — нормализацию регистра делает другой шаг."
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
                    "brands": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["name", "brands"],
            },
        }
    },
    "required": ["items"],
}


async def detect_brands(names: list[str]) -> list[tuple[str, list[str]]]:
    """Return [(name_as_returned, brands), ...] preserving input order."""
    if not names:
        return []
    client = get_client()
    user_payload = json.dumps({"names": names}, ensure_ascii=False)
    resp = await client.chat.completions.create(
        model=settings.PARSER_MODEL,
        messages=[
            {"role": "system", "content": PROMPT},
            {"role": "user", "content": user_payload},
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {"name": "shopping_items_brands", "schema": JSON_SCHEMA, "strict": True},
        },
        temperature=0,
    )
    raw = resp.choices[0].message.content or "{}"
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("LLM returned non-JSON: %r — skipping batch", raw)
        return [(n, []) for n in names]
    items = data.get("items") or []
    out: list[tuple[str, list[str]]] = []
    # LLM should preserve length and order, but fall back gracefully if not.
    for orig, item in zip(names, items):
        brands_raw = item.get("brands") or []
        brands = [b for b in (str(x).strip() for x in brands_raw) if b]
        out.append((orig, brands))
    if len(items) != len(names):
        logger.warning(
            "LLM returned %d items for %d names — tail will get empty brands",
            len(items),
            len(names),
        )
        for orig in names[len(items):]:
            out.append((orig, []))
    return out


async def run(dry_run: bool) -> None:
    db_path = settings.DB_PATH
    logger.info("Opening DB: %s (dry_run=%s)", db_path, dry_run)
    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT id, name FROM items ORDER BY id")
        rows = await cur.fetchall()
    total = len(rows)
    logger.info("Loaded %d items", total)
    if not total:
        return

    changes: list[tuple[int, str, str]] = []  # (id, old, new)
    for start in range(0, total, BATCH_SIZE):
        batch = rows[start:start + BATCH_SIZE]
        names = [r["name"] for r in batch]
        try:
            detected = await detect_brands(names)
        except Exception:
            logger.exception("Brand detection failed for batch starting at %d", start)
            continue
        for row, (_orig, brands) in zip(batch, detected):
            new_name = format_item_name(row["name"], brands)
            if new_name and new_name != row["name"]:
                changes.append((row["id"], row["name"], new_name))
                print(f"  #{row['id']}: {row['name']!r} → {new_name!r}")
        logger.info("Processed %d/%d", min(start + BATCH_SIZE, total), total)

    print()
    print(f"Diff: {len(changes)} item(s) out of {total} will change.")
    if dry_run:
        print("Dry run — no DB writes performed.")
        return
    if not changes:
        print("Nothing to update.")
        return
    async with aiosqlite.connect(db_path) as db:
        for item_id, _old, new_name in changes:
            await db.execute("UPDATE items SET name = ? WHERE id = ?", (new_name, item_id))
        await db.commit()
    print(f"Applied {len(changes)} update(s).")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print proposed changes without writing to the DB.",
    )
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    asyncio.run(run(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
