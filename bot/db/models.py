from dataclasses import dataclass
from typing import Optional


@dataclass
class NamedList:
    """A user-facing named list (bucket): «Общее»/«Тата»/«Максим»."""
    id: int
    key: str
    name: str
    color: Optional[str]
    position: int
    is_default: bool


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
    category: Optional[str] = None
    named_list_id: Optional[int] = None


@dataclass
class ShoppingList:
    id: int
    status: str
    created_at: int
    archived_at: Optional[int]
    items: list[Item]
    named_list_id: Optional[int] = None
