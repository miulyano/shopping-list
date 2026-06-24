from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel

from bot.config import settings
from bot.db.store import connect
from bot.services import ingest_state
from bot.services.parser import normalize_category
from bot.services.shopping import (
    archive_count,
    archive_purchased,
    delete_archive_list,
    delete_item,
    ensure_active_list,
    get_archive,
    get_archive_list,
    get_named_lists,
    get_state,
    move_item,
    reuse_archive_list,
    set_item_done,
    update_item,
)
from webapp.auth import validate_init_data


router = APIRouter(prefix="/api")


async def current_user(
    x_telegram_init_data: str | None = Header(default=None, alias="X-Telegram-Init-Data"),
) -> int:
    if not x_telegram_init_data:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing init data")
    info = validate_init_data(x_telegram_init_data, settings.BOT_TOKEN)
    if not info or not info.get("user_id"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid init data")
    user_id = int(info["user_id"])
    if user_id not in settings.allowed_user_ids:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "user not allowed")
    return user_id


def _list_to_dict(lst) -> dict:
    return {
        "id": lst.id,
        "created_at": lst.created_at,
        "archived_at": lst.archived_at,
        "named_list_id": lst.named_list_id,
        "items": [
            {
                "id": i.id,
                "name": i.name,
                "qty": i.qty,
                "done": i.done,
                "position": i.position,
                "category": i.category,
                "named_list_id": i.named_list_id,
            }
            for i in lst.items
        ],
    }


def _named_list_to_dict(nl) -> dict:
    return {
        "id": nl.id,
        "key": nl.key,
        "name": nl.name,
        "color": nl.color,
        "position": nl.position,
        "is_default": nl.is_default,
    }


def _ingest_to_dict(ev) -> dict:
    return {
        "id": ev.id,
        "kind": ev.kind,
        "stage": ev.stage,
        "title": ev.title,
        "sub": ev.sub,
        "added": ev.added,
        "updated_at": ev.updated_at,
    }


class ItemPatch(BaseModel):
    name: str
    qty: str | None = None
    category: str | None = None


class ItemState(BaseModel):
    done: bool


class ItemMove(BaseModel):
    named_list_id: int


class ArchivePurchased(BaseModel):
    named_list_id: int | None = None


@router.get("/state")
async def state(user_id: int = Depends(current_user)) -> dict:
    async with connect() as db:
        active = await get_state(db)
        cnt = await archive_count(db)
        ev = await ingest_state.get_active(db, user_id)
        lists = await get_named_lists(db)
    return {
        "active_list": _list_to_dict(active) if active else None,
        "archive_count": cnt,
        "ingest": _ingest_to_dict(ev) if ev else None,
        "lists": [_named_list_to_dict(nl) for nl in lists],
    }


@router.get("/archive")
async def archive(_: int = Depends(current_user)) -> dict:
    async with connect() as db:
        lists = await get_archive(db)
    return {"lists": [_list_to_dict(l) for l in lists]}


@router.get("/archive/{list_id}")
async def archive_detail(list_id: int, _: int = Depends(current_user)) -> dict:
    async with connect() as db:
        lst = await get_archive_list(db, list_id)
    if lst is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "archive list not found")
    return _list_to_dict(lst)


@router.post("/archive/{list_id}/reuse")
async def archive_reuse(list_id: int, user_id: int = Depends(current_user)) -> dict:
    async with connect() as db:
        result = await reuse_archive_list(db, list_id, user_id)
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "archive list not found")
    active_id, added = result
    return {"list_id": active_id, "added": added}


@router.delete("/archive/{list_id}")
async def archive_delete(list_id: int, _: int = Depends(current_user)) -> dict:
    async with connect() as db:
        ok = await delete_archive_list(db, list_id)
    if not ok:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "archive list not found")
    return {"deleted": True}


@router.post("/items/{item_id}/state")
async def set_state(
    item_id: int, payload: ItemState, user_id: int = Depends(current_user)
) -> dict:
    async with connect() as db:
        result = await set_item_done(db, item_id, user_id, payload.done)
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "item not found")
    list_id, done, archived_named_list_id = result
    return {
        "list_id": list_id,
        "done": done,
        "archived": archived_named_list_id is not None,
        "archived_named_list_id": archived_named_list_id,
    }


@router.patch("/items/{item_id}")
async def patch_item(
    item_id: int, payload: ItemPatch, _: int = Depends(current_user)
) -> dict:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "name is required")
    category = (
        normalize_category(payload.category) if payload.category is not None else None
    )
    async with connect() as db:
        list_id = await update_item(db, item_id, name, payload.qty, category)
    if list_id is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "item not found")
    return {
        "id": item_id,
        "list_id": list_id,
        "name": name,
        "qty": payload.qty,
        "category": category,
    }


@router.post("/items/{item_id}/move")
async def move_item_endpoint(
    item_id: int, payload: ItemMove, _: int = Depends(current_user)
) -> dict:
    async with connect() as db:
        list_id = await move_item(db, item_id, payload.named_list_id)
    if list_id is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "item not found")
    return {"id": item_id, "list_id": list_id, "named_list_id": payload.named_list_id}


@router.delete("/items/{item_id}")
async def remove_item(item_id: int, _: int = Depends(current_user)) -> dict:
    async with connect() as db:
        list_id = await delete_item(db, item_id)
    if list_id is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "item not found")
    return {"id": item_id, "list_id": list_id, "deleted": True}


@router.post("/lists/{list_id}/archive-purchased")
async def list_archive_purchased(
    list_id: int,
    payload: ArchivePurchased | None = None,
    _: int = Depends(current_user),
) -> dict:
    named_list_id = payload.named_list_id if payload else None
    async with connect() as db:
        result = await archive_purchased(db, list_id, named_list_id)
    if result is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "active list not found or nothing to archive"
        )
    archive_id, moved = result
    return {"archived_list_id": archive_id, "moved": moved}


@router.post("/lists/new")
async def new_list(user_id: int = Depends(current_user)) -> dict:
    async with connect() as db:
        active = await get_state(db)
        if active is not None and active.items:
            raise HTTPException(status.HTTP_409_CONFLICT, "active list not empty")
        list_id = await ensure_active_list(db)
    return {"id": list_id}
