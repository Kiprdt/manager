# Деплой на сервер (Docker, сборка на сервере)

Стек: pnpm-монорепо (`shared`/`api`/`web`), Fastify+Prisma+**SQLite**, React/Vite за nginx.
БД — один SQLite-файл на docker-томе. Доступ по **IP**, веб на порту **8080** (443/8443 заняты VPN).

## Что уже готово в репозитории
- `docker-compose.yml` — api (внутренний) + web (nginx на `WEB_PORT`). БД SQLite на томе `app-db`, вложения на томе `uploads`.
- `packages/api/Dockerfile` — собирает api, при старте: `prisma migrate deploy && node dist/server.js`.
- `packages/web/Dockerfile` — собирает фронт, отдаёт через nginx; `/api`, `/ws`, `/uploads` проксируются на api.
- Миграции Prisma закоммичены (нужны для `migrate deploy`).
- `.env.example` — шаблон серверного окружения.

## Предпосылки на сервере
- Docker + Docker Compose plugin (`docker compose version`).
- Свободный порт **8080** (или другой — задаётся `WEB_PORT`).

## Шаги

```bash
# 1. Клонировать репозиторий
git clone <URL_РЕПО> life-manager
cd life-manager

# 2. Создать .env из шаблона и заполнить
cp .env.example .env
#   JWT_SECRET — обязателен, ≥16 символов:
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" .env
#   при необходимости поправьте WEB_PORT и CORS_ORIGIN

# 3. Собрать и запустить
docker compose up -d --build

# 4. Проверить
docker compose ps
curl -s http://localhost:8080/api/../health   # ожидаем {"status":"ok"} через nginx: см. ниже
curl -s http://localhost:3001/health || true  # api наружу закрыт — проверяйте изнутри web-сети
docker compose logs -f api                     # "Server listening", без ошибок Prisma
```

Откройте в браузере: `http://<IP_СЕРВЕРА>:8080` → зарегистрируйте аккаунт.

> Первый зарегистрированный аккаунт «забирает» все существующие данные с `userId = null`
> (на чистой БД это просто создаёт пользователя).

## Обновление (выкатка новой версии)

```bash
cd life-manager
git pull
docker compose up -d --build
```

Данные сохраняются в томах `app-db` (БД) и `uploads` (вложения) — пересборка их не трогает.

## Бэкап / восстановление БД

```bash
# Бэкап файла SQLite из тома
docker compose cp api:/data/app.db ./app.db.backup
# Восстановление
docker compose cp ./app.db.backup api:/data/app.db && docker compose restart api
```

## Полезное
- Логи: `docker compose logs -f api` / `... web`.
- Остановить: `docker compose down` (тома сохраняются). Полностью удалить с данными: `docker compose down -v`.
- Сменить порт: поправьте `WEB_PORT` в `.env` и `docker compose up -d`.
- HTTPS: 443 занят VPN. Если нужен TLS — поставьте Caddy/nginx на свободном порту (напр. 9443)
  перед сервисом `web`; фронт сам строит ws/https-URL от текущего origin, менять сборку не нужно.

## Telegram / LLM (опционально)
Включаются в ⚙ Настройках приложения (токен бота, LLM-ключ) или через переменные в `.env`
(`TELEGRAM_MODE=polling`, `TELEGRAM_BOT_TOKEN`, `LLM_API_KEY` …). Регулярные платежи проводятся
планировщиком автоматически (раз в час), бот понимает `/balance`, `/expense`, `/income`, `/payments`.
