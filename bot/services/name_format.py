from __future__ import annotations

import re
from typing import Iterable, Optional


_WHITESPACE_RE = re.compile(r"\s+")


def format_item_name(raw: str, brands: Optional[Iterable[str]] = None) -> str:
    """Lowercase the item name, then restore the canonical case for each brand.

    `brands` is a list of brand strings exactly as they should appear in the
    final name (e.g. ``"Coca-Cola"``, ``"iPhone"``, ``"Простоквашино"``). Each
    brand is matched case-insensitively against the lowercased name and replaced
    with its canonical form. Brands that don't actually occur in the name are
    silently ignored (handles LLM hallucinations).
    """
    result = (raw or "").lower().strip()
    if not result:
        return ""
    if brands:
        for brand in brands:
            brand = (brand or "").strip()
            if not brand:
                continue
            pattern = re.compile(
                r"(?<!\w)" + re.escape(brand.lower()) + r"(?!\w)",
                flags=re.IGNORECASE | re.UNICODE,
            )
            result = pattern.sub(brand, result)
    return _WHITESPACE_RE.sub(" ", result).strip()
