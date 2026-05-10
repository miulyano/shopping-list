# shopping-list

[![version](https://img.shields.io/badge/version-0.3.0-blue.svg)](CHANGELOG.md)

Telegram-бот + Mini App для общего списка покупок. Принимает текст, голосовые сообщения и фото — раскладывает в плоский список через OpenAI (Whisper + gpt-4o). Список один и общий для всех whitelisted-пользователей; когда все товары отмечены купленными — уходит в архив, и можно создать новый.

## Что умеет

- **Текст** — «молоко 1 л, хлеб, яйца 10 шт» → 3 позиции в списке.
- **Голосовое** — Whisper транскрибирует, парсер выделяет товары.
- **Фото** — gpt-4o (vision) распознаёт чек, продукты в холодильнике/на полке, рукописные записки.
- **Mini App** — один активный список, прогресс-бар, чекбоксы, авто-архивирование.
- **Архив** — все закрытые списки с датами и составом.
- **Whitelist** — `ALLOWED_USER_IDS` ограничивает, кто может писать боту и открывать mini-app.
- **Группа + личка** — бот работает в одном групповом чате (`TARGET_CHAT_ID`) и в DM whitelisted-юзеров. Список общий.
- **Обратная связь** — на каждое входящее сообщение бот шлёт промежуточный статус («📝 Разбираю…», «📷 Распознаю фото…», «🎙 Слушаю…») и заменяет его финалом «✓ Добавил N товаров». В групповом чате ответы привязаны reply'ем к исходному сообщению.
- **Mini App из группы** — кнопка «🛒 Открыть список» работает и в DM (через `WebAppInfo`), и в группе (через direct-link `t.me/<bot>/<short_name>`, см. `WEBAPP_SHORT_NAME`). При добавлении бота в группу он автоматически шлёт приветственное сообщение с кнопкой и пинит его.

## Стек

- Python 3.11 (bot) / 3.12 (webapp)
- [aiogram 3.15](https://github.com/aiogram/aiogram) — Telegram Bot API
- [FastAPI](https://fastapi.tiangolo.com/) + uvicorn — webapp
- [OpenAI SDK](https://github.com/openai/openai-python) — Whisper, gpt-4o, gpt-4o-mini
- aiosqlite — SQLite-хранилище
- pydantic-settings — конфиг из `.env`
- ffmpeg (системная зависимость) — нормализация голосовых в MP3 16kHz mono
- React 18 + Babel-standalone (CDN) — mini-app (без build-step)

## Структура проекта

```
shopping-list/
├── bot/
│   ├── main.py                 # entry, Dispatcher, set_chat_menu_button
│   ├── config.py               # pydantic Settings
│   ├── handlers/
│   │   ├── commands.py         # /start /help /new
│   │   ├── text.py             # F.text — парсер списка
│   │   ├── voice.py            # F.voice — Whisper → парсер
│   │   ├── photo.py            # F.photo — gpt-4o vision
│   │   └── membership.py       # my_chat_member — приветствие+пин при добавлении в группу
│   ├── middlewares/auth.py     # whitelist + chat filter
│   ├── services/
│   │   ├── openai_client.py    # singleton AsyncOpenAI
│   │   ├── parser.py           # text → list[ParsedItem]
│   │   ├── transcriber.py      # voice → text via Whisper
│   │   ├── vision.py           # image → list[ParsedItem] via gpt-4o
│   │   ├── ffmpeg_runner.py    # async subprocess
│   │   ├── media.py            # .ogg → .mp3 16k mono
│   │   ├── shopping.py         # бизнес-логика (списки, items, архив)
│   │   └── temp_cleanup.py     # периодическая чистка TEMP_DIR
│   └── db/
│       ├── schema.sql          # lists, items
│       ├── store.py            # connect, init_db
│       └── models.py
├── webapp/
│   ├── main.py                 # FastAPI app + lifespan
│   ├── auth.py                 # initData HMAC verification
│   ├── api.py                  # /api/state /api/archive /api/items/.../toggle /api/lists/new
│   └── static/
│       ├── index.html          # mini-app shell
│       └── app.js              # React-приложение (порт Claude Design handoff)
├── tests/
│   ├── conftest.py
│   ├── test_auth.py
│   ├── test_parser.py
│   ├── test_shopping.py
│   ├── test_webapp_auth.py
│   └── test_webapp_api.py
├── design/                     # оригинальный handoff-zip из Claude Design (не git-tracked в проде)
├── data/                       # gitignored: shopping.db
├── Dockerfile.bot
├── Dockerfile.webapp
├── docker-compose.yml
├── requirements.txt
├── requirements-webapp.txt
├── requirements-dev.txt
├── pytest.ini
├── .env.example
├── VERSION
├── CHANGELOG.md
└── README.md
```

## .env

```env
BOT_TOKEN=                                 # токен бота от @BotFather
OPENAI_API_KEY=                            # ключ OpenAI
ALLOWED_USER_IDS=                          # CSV: 12345,67890
TARGET_CHAT_ID=                            # id группового чата (опционально)
WEBAPP_URL=https://shopping-list.ulyanov.fun
WEBAPP_SHORT_NAME=                         # short-name Mini App из BotFather (нужен для группового чата)
DB_PATH=data/shopping.db
TEMP_DIR=/tmp/shopping-list
LOG_LEVEL=INFO
```

`TARGET_CHAT_ID` — id группового чата (целое со знаком `-`, например `-1001234567890`). Бот игнорирует сообщения из любых других групповых чатов. Если не задан — бот отвечает только на DM whitelisted-юзеров.

### Mini App в групповом чате (`WEBAPP_SHORT_NAME`)

Telegram Bot API запрещает inline-кнопки `web_app` вне приватных чатов — отправка
сообщения с такой кнопкой в группу падает с ошибкой. Чтобы кнопка «🛒 Открыть список»
работала в группе, Mini App нужно зарегистрировать как **Direct Link Mini App**:

1. @BotFather → выбрать бота → `/newapp`.
2. Указать название, описание, иконку и тот же URL, что в `WEBAPP_URL`.
3. Задать short-name (например, `list`).
4. В `.env` прописать `WEBAPP_SHORT_NAME=list`, перезапустить бота.

После этого:

- В DM кнопка по-прежнему открывает нативный Mini App (через `web_app=`, по `WEBAPP_URL`).
- В группе под ответами бота появляется URL-кнопка `https://t.me/<bot_username>/<short_name>` — открывает тот же Mini App, `initData` валидируется так же.
- При добавлении бота в группу он автоматически постит приветственное сообщение с кнопкой и пинит его (нужно право `can_pin_messages`; без него сообщение остаётся непинованным, бот не падает).
- Если бот уже был в группе на момент деплоя и `my_chat_member`-автопин не сработал, любой whitelisted-пользователь может вызвать `/pin` в группе — бот пришлёт тот же приветственный пост и запиннит.

Если `WEBAPP_SHORT_NAME` не задан — в группе кнопка просто не показывается, всё остальное работает.

## Как развернуть свой

1. Создать бота через [@BotFather](https://t.me/BotFather), получить `BOT_TOKEN`.
2. Получить `OPENAI_API_KEY` на https://platform.openai.com/.
3. Узнать свой Telegram user_id (например, через [@userinfobot](https://t.me/userinfobot)).
4. Клонировать репо, скопировать `.env.example` в `.env`, заполнить значения.
5. Поднять контейнеры:
   ```bash
   docker compose up -d --build
   ```
6. Открыть mini-app по `WEBAPP_URL` (или через menu button бота).

Локальный запуск без docker:

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -r requirements-webapp.txt
# bot:
python -m bot.main
# webapp (в другом терминале):
uvicorn webapp.main:app --host 0.0.0.0 --port 8000
```

## Тесты

```bash
source .venv/bin/activate
pip install -r requirements-dev.txt
pytest -v
```

Все тесты должны быть зелёные. Если тест упал — чинить **код**, а не тест (см. `CLAUDE.md`).

## Деплой на VPS

Хост: `ssh vps`. Ставимся в `/opt/shopping-list`, рядом с `notes-bot` и `life-transcriber`.

1. Смержить PR в `main` (squash merge).
2. На vps:
   ```bash
   ssh vps
   sudo mkdir -p /opt/shopping-list && cd /opt/shopping-list
   git clone git@github.com:miulyano/shopping-list.git .
   cp .env.example .env
   vim .env                                  # заполнить токены и whitelist
   docker compose up -d --build
   ```
3. Добавить блок в `/opt/caddy/Caddyfile` (с бэкапом!):
   ```bash
   ssh vps 'cd /opt/caddy && cp Caddyfile Caddyfile.bak.$(date +%s)'
   # затем добавить:
   #   shopping-list.ulyanov.fun {
   #       reverse_proxy shopping-list-webapp-1:8000
   #   }
   ssh vps 'cd /opt/caddy && docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile'
   ```
4. Проверить:
   ```bash
   ssh vps 'cd /opt/shopping-list && docker compose ps && docker compose logs --tail 30'
   curl -I https://shopping-list.ulyanov.fun/
   ```
   Контейнеры — `Up`, curl — `200 OK`. В логах бота — `Bot started`.

### Verify-чеклист (E2E)

1. Whitelisted user пишет в DM боту «молоко 1 л, хлеб, яйца» → ответ «✓ Добавил 3 товара».
2. Открыть mini-app через menu button → видим 3 позиции.
3. Со второго whitelisted-аккаунта открыть mini-app → видим то же.
4. На первом отметить «молоко» купленным → через ≤3 сек на втором чекбокс заполнен.
5. Отметить остальные → бэйдж «Все товары куплены — переношу в архив...» → EmptyState с «Архив · 1».
6. «Новый список» → app закрывается, мы в чате с ботом.
7. Голосовое «купи курицу и рис» → транскрибация → 2 товара.
8. Фото чека → распознаются позиции.
9. Не-whitelisted user пишет боту → бот молчит.

## Ветки и коммиты

См. `CLAUDE.md` — ветки в формате `<type>/<kebab>` (`feat/`, `fix/`, ...), коммиты по [Conventional Commits](https://www.conventionalcommits.org/), мердж только squash, прямые коммиты в `main` запрещены.
