from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Depends, Header, HTTPException, status

from bot.config import settings
from bot.db.store import connect
from bot.services.shopping import (
    archive_count,
    ensure_active_list,
    get_archive,
    get_state,
    toggle_item,
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
        "items": [
            {
                "id": i.id,
                "name": i.name,
                "qty": i.qty,
                "done": i.done,
                "position": i.position,
            }
            for i in lst.items
        ],
    }


@router.get("/state")
async def state(_: int = Depends(current_user)) -> dict:
    async with connect() as db:
        active = await get_state(db)
        cnt = await archive_count(db)
    return {
        "active_list": _list_to_dict(active) if active else None,
        "archive_count": cnt,
    }


@router.get("/archive")
async def archive(_: int = Depends(current_user)) -> dict:
    async with connect() as db:
        lists = await get_archive(db)
    return {"lists": [_list_to_dict(l) for l in lists]}


@router.post("/items/{item_id}/toggle")
async def toggle(item_id: int, user_id: int = Depends(current_user)) -> dict:
    async with connect() as db:
        result = await toggle_item(db, item_id, user_id)
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "item not found")
    list_id, done, archived = result
    return {"list_id": list_id, "done": done, "archived": archived}


@router.post("/lists/new")
async def new_list(user_id: int = Depends(current_user)) -> dict:
    async with connect() as db:
        active = await get_state(db)
        if active is not None and active.items:
            raise HTTPException(status.HTTP_409_CONFLICT, "active list not empty")
        list_id = await ensure_active_list(db)
    return {"id": list_id}
