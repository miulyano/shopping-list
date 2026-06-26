import asyncio
import logging
import os
from contextlib import suppress

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.types import (
    BotCommand,
    MenuButtonDefault,
    MenuButtonWebApp,
    WebAppInfo,
)

from bot.config import settings
from bot.db.store import init_db
from bot.handlers import commands, membership, photo, text, voice
from bot.middlewares.auth import AuthMiddleware
from bot.services.temp_cleanup import run_periodic_temp_cleanup


logger = logging.getLogger(__name__)


async def main() -> None:
    logging.basicConfig(
        level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    os.makedirs(settings.TEMP_DIR, exist_ok=True)
    await init_db()

    cleanup_task = asyncio.create_task(
        run_periodic_temp_cleanup(settings.TEMP_DIR, logger=logger)
    )

    bot = Bot(
        token=settings.BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = Dispatcher()
    auth = AuthMiddleware()
    dp.message.middleware(auth)
    dp.my_chat_member.middleware(auth)

    dp.include_router(commands.router)
    dp.include_router(voice.router)
    dp.include_router(photo.router)
    dp.include_router(text.router)
    dp.include_router(membership.router)

    await bot.set_my_commands([
        BotCommand(command="start", description="Что умеет бот"),
        BotCommand(command="help", description="Помощь"),
        BotCommand(command="new", description="Новый список"),
        BotCommand(command="pin", description="Запинить пост с кнопкой Mini App (в группе)"),
    ])

    if settings.WEBAPP_URL:
        await bot.set_chat_menu_button(
            menu_button=MenuButtonWebApp(
                text="Список",
                web_app=WebAppInfo(url=settings.WEBAPP_URL),
            )
        )
        logger.info("Mini app menu button set: %s", settings.WEBAPP_URL)
    else:
        await bot.set_chat_menu_button(menu_button=MenuButtonDefault())

    logger.info(
        "Bot started. Allowed users: %s. Target chat: %s",
        settings.allowed_user_ids, settings.TARGET_CHAT_ID,
    )
    try:
        await dp.start_polling(
            bot,
            allowed_updates=dp.resolve_used_update_types(),
            drop_pending_updates=True,
        )
    finally:
        cleanup_task.cancel()
        with suppress(asyncio.CancelledError):
            await cleanup_task


if __name__ == "__main__":
    asyncio.run(main())
