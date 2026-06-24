"""One-shot migration: assign a category (food/home/care) to every `items` row
that still has `category IS NULL` — both the active list and archived lists live
in the same table, so a single pass covers everything.

Usage (run inside the bot container or with a venv that has the bot's deps):

    python scripts/backfill_categories.py --dry-run   # preview the split
    python scripts/backfill_categories.py             # apply changes

Idempotent: only rows with NULL category are touched, so a second run is a no-op.
Always back up the DB first:

    cp data/shopping.db data/shopping.db.bak.$(date +%s)
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path

# Allow running as `python scripts/backfill_categories.py` from repo root.
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import aiosqlite  # noqa: E402

from bot.config import settings  # noqa: E402
from bot.services.openai_client import get_client  # noqa: E402
from bot.services.parser import (  # noqa: E402
    CATEGORIES,
    DEFAULT_CATEGORY,
    normalize_category,
)


logger = logging.getLogger("backfill_categories")


BATCH_SIZE = 40

PROMPT = (
    "Тебе придёт массив `names` — каждая строка это название товара из списка покупок. "
    "Для каждой строки определи категорию и верни объект "
    "`{\"name\": <строка-как-есть>, \"category\": <one of food|home|care>}`.\n"
    "  - `food` — продукты и напитки (еда, вода, соки, кофе, чай, алкоголь, корм для "
    "животных, детское питание);\n"
    "  - `home` — бытовые и хозяйственные товары: бытовая химия и расходники "
    "(средство для посуды, стиральный порошок, мешки для мусора, фольга, салфетки, "
    "губки), посуда, лампочки, батарейки, инструменты, текстиль, товары для дома;\n"
    "  - `care` — гигиена и косметика (зубная паста, шампунь, мыло, гель для душа, "
    "дезодорант, бритвы, прокладки, ватные диски, крем, косметика).\n"
    "Если товар явно не home и не care — ставь `food`. "
    "Поле `name` верни строго таким, как прислали."
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
                    "category": {"type": "string", "enum": list(CATEGORIES)},
                },
                "required": ["name", "category"],
            },
        }
    },
    "required": ["items"],
}


async def classify(names: list[str]) -> dict[str, str]:
    """Return {name: category} for the given names. Unknowns fall back to food."""
    if not names:
        return {}
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
            "json_schema": {"name": "item_categories", "schema": JSON_SCHEMA, "strict": True},
        },
        temperature=0,
    )
    raw = resp.choices[0].message.content or "{}"
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("LLM returned non-JSON: %r — batch defaults to %s", raw, DEFAULT_CATEGORY)
        return {n: DEFAULT_CATEGORY for n in names}
    out: dict[str, str] = {}
    for item in data.get("items") or []:
        name = item.get("name")
        if isinstance(name, str):
            out[name] = normalize_category(item.get("category"))
    # Anything the LLM dropped gets the default so no row is left NULL.
    for n in names:
        out.setdefault(n, DEFAULT_CATEGORY)
    return out


async def run(dry_run: bool) -> None:
    db_path = settings.DB_PATH
    logger.info("Opening DB: %s (dry_run=%s)", db_path, dry_run)
    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute(
            "SELECT DISTINCT name FROM items WHERE category IS NULL ORDER BY name"
        )
        names = [r["name"] for r in await cur.fetchall()]
    total = len(names)
    logger.info("Found %d distinct uncategorized name(s)", total)
    if not total:
        print("Nothing to categorize — all rows already have a category.")
        return

    mapping: dict[str, str] = {}
    for start in range(0, total, BATCH_SIZE):
        batch = names[start:start + BATCH_SIZE]
        try:
            mapping.update(await classify(batch))
        except Exception:
            logger.exception("Classification failed for batch at %d — defaulting to %s", start, DEFAULT_CATEGORY)
            for n in batch:
                mapping.setdefault(n, DEFAULT_CATEGORY)
        logger.info("Processed %d/%d", min(start + BATCH_SIZE, total), total)

    dist: dict[str, int] = {c: 0 for c in CATEGORIES}
    for cat in mapping.values():
        dist[cat] = dist.get(cat, 0) + 1
    print()
    for name in names:
        print(f"  {mapping[name]:5}  {name}")
    print()
    print("Distribution: " + ", ".join(f"{c}={dist.get(c, 0)}" for c in CATEGORIES))

    if dry_run:
        print("Dry run — no DB writes performed.")
        return
    async with aiosqlite.connect(db_path) as db:
        updated = 0
        for name, cat in mapping.items():
            cur = await db.execute(
                "UPDATE items SET category = ? WHERE name = ? AND category IS NULL",
                (cat, name),
            )
            updated += cur.rowcount
        await db.commit()
    print(f"Applied: {updated} row(s) categorized.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the proposed category split without writing to the DB.",
    )
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    asyncio.run(run(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
