from dataclasses import dataclass
from typing import Optional


@dataclass
class Item:
    id: int
    list_id: int
    name: str
    qty: Optional[str]
    done: bool
    added_by: int
    added_at: int
    checked_by: Optional[int]
    checked_at: Optional[int]
    position: int


@dataclass
class ShoppingList:
    id: int
    status: str
    created_at: int
    archived_at: Optional[int]
    items: list[Item]
