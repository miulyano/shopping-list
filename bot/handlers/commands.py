from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message

from bot.db.store import connect
from bot.handlers._common import open_app_keyboard
from bot.services.shopping import archive_active_list, ensure_active_list, get_state


router = Router()


async def _keyboard(message: Message):
    me = await message.bot.me()
    return open_app_keyboard(message.chat.type, me.username)


@router.message(Command("start"))
async def cmd_start(message: Message) -> None:
    text = (
        "Привет! Я собираю общий список покупок.\n\n"
        "Отправляй сюда:\n"
        "• текст — «молоко 1 л, хлеб, яйца 10 шт»\n"
        "• голосовое — «купи курицу и рис»\n"
        "• фото — чек, холодильник, записку\n\n"
        "Я разложу всё в плоский список. Открыть его — кнопкой ниже или через меню."
    )
    await message.answer(text, reply_markup=await _keyboard(message))


@router.message(Command("help"))
async def cmd_help(message: Message) -> None:
    await cmd_start(message)


@router.message(Command("new"))
async def cmd_new(message: Message) -> None:
    kb = await _keyboard(message)
    async with connect() as db:
        state = await get_state(db)
        if state is not None and state.items:
            await message.answer(
                f"Уже есть активный список ({len(state.items)} товаров). Закройте его или отметьте всё купленным.",
                reply_markup=kb,
            )
            return
        if state is not None:
            await archive_active_list(db, state.id)
        await ensure_active_list(db)
    await message.answer("Создан новый список. Присылай товары.", reply_markup=kb)
