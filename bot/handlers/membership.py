import logging

from aiogram import Bot, Router
from aiogram.types import ChatMemberUpdated, InlineKeyboardMarkup

from bot.handlers._common import open_app_keyboard


router = Router()
logger = logging.getLogger(__name__)


_OUT_STATUSES = {"left", "kicked"}
_IN_STATUSES = {"member", "administrator", "creator", "restricted"}

WELCOME_TEXT = (
    "🛒 Список покупок\n\n"
    "Кидайте сюда текст, голос или фото — я разложу всё в общий список."
)


async def post_and_pin_welcome(
    bot: Bot,
    chat_id: int,
    chat_type: str,
    keyboard: InlineKeyboardMarkup | None,
    message_thread_id: int | None = None,
) -> int:
    """Send the welcome message with the Mini App button and pin it.

    In forum-style supergroups, pass `message_thread_id` so the message is
    posted (and therefore pinned) within the caller's topic instead of the
    General topic. Pin is best-effort: if the bot lacks `can_pin_messages`,
    the message stays unpinned and we just log.
    """
    msg = await bot.send_message(
        chat_id,
        WELCOME_TEXT,
        reply_markup=keyboard,
        message_thread_id=message_thread_id,
    )
    try:
        await bot.pin_chat_message(chat_id, msg.message_id, disable_notification=True)
    except Exception:
        logger.warning("Pin failed (likely missing can_pin_messages permission)")
    return msg.message_id


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
    await post_and_pin_welcome(event.bot, event.chat.id, event.chat.type, kb)
