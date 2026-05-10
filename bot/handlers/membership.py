import logging

from aiogram import Router
from aiogram.types import ChatMemberUpdated

from bot.handlers._common import open_app_keyboard


router = Router()
logger = logging.getLogger(__name__)


_OUT_STATUSES = {"left", "kicked"}
_IN_STATUSES = {"member", "administrator", "creator", "restricted"}


@router.my_chat_member()
async def on_my_chat_member(event: ChatMemberUpdated) -> None:
    if event.chat.type not in ("group", "supergroup"):
        return
    old_status = event.old_chat_member.status if event.old_chat_member else None
    new_status = event.new_chat_member.status if event.new_chat_member else None
    if old_status not in _OUT_STATUSES or new_status not in _IN_STATUSES:
        return

    me = await event.bot.me()
    kb = open_app_keyboard(event.chat.type, me.username)
    msg = await event.bot.send_message(
        event.chat.id,
        "🛒 Список покупок\n\nКидайте сюда текст, голос или фото — я разложу всё в общий список.",
        reply_markup=kb,
    )
    try:
        await event.bot.pin_chat_message(
            event.chat.id, msg.message_id, disable_notification=True
        )
    except Exception:
        logger.warning("Pin failed (likely missing can_pin_messages permission)")
