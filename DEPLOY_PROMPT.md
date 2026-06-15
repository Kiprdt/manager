# Деплой Life Manager на сервер (Docker) — план + промт для Devin

Документ из двух частей: **(A)** что обязательно поправить в коде/инфре перед деплоем (с обоснованием),
и **(B)** готовый промт, который можно отдать Devin.

---

## ⚠️ ОБНОВЛЕНИЕ (актуальное состояние — читать первым)

Часть пунктов ниже устарела. Что изменилось:

- **Аутентификация ЕСТЬ.** Добавлен JWT-слой (`User`, `/api/auth/*`, изоляция всех данных по `userId`). Раздел про «аутентификации нет» неактуален. В проде **обязателен `JWT_SECRET` (≥16 символов)** — без него api не стартует (`NODE_ENV=production`). `CORS_ORIGIN` — задать конкретный домен (по умолчанию `*` с предупреждением в логах).
- **БД — выбран SQLite** (файл на томе `app-db`, `DATABASE_URL=file:/data/app.db`). Postgres из `docker-compose.yml` убран; миграции остаются SQLite-овыми и применяются в контейнере через `prisma migrate deploy`. (Пункт A1 про Postgres больше не актуален.)
- **Уже исправлено в коде:** A2 (Dockerfile копирует `pnpm-lock.yaml`), A3 (том `uploads` + проксирование `/uploads/` в nginx + `client_max_body_size 25m`), A4 (web собирается с build-args `VITE_*`; WS-URL строится от `window.location`, см. `packages/web/src/lib/ws.ts`), A5 (есть `.dockerignore`), A6 (WS-заголовки Host/X-Forwarded-Proto в nginx).
- **Осталось вручную на сервере:** задать `JWT_SECRET` и `CORS_ORIGIN` (через `.env`/окружение compose), поставить перед web реверс-прокси с TLS (Caddy) — A7.
- **Не блокеры, но желательно до публичного прода:** rate-limit на `/api/auth/*`, мультивалютность в сводке (netWorth суммирует валюты без конвертации), деньги во Float, авто-проведение регулярных платежей (cron), тесты на денежную математику.

Запуск: `JWT_SECRET=... CORS_ORIGIN=https://домен docker compose up -d --build` → открыть `http://сервер:8080` (или за TLS-прокси).

---

## Текущее состояние проекта (для контекста)
- Монорепо pnpm workspaces: `packages/shared` (zod-схемы + util), `packages/api` (Fastify + Prisma, **SQLite** в dev), `packages/web` (Vite + React, react-query, FullCalendar).
- Разделы/модули API: tasks, timeblocks, categories, habits, health (вес/тренировки/питание/добавки/настройки), finance (бюджет/инструменты), goals, notes (+ **загрузка файлов**), insights (LLM-анализ), settings (Telegram/LLM/proxy). Реалтайм через **WebSocket** `/ws`.
- **Файлы-вложения** хранятся на диске в `packages/api/uploads/` и отдаются статикой по `/uploads/...`.
- Интеграции (Telegram-бот, LLM/Gemini, исходящий proxy) настраиваются **в самом приложении** (⚙ Настройки, хранятся в БД `Setting`) ИЛИ через env как fallback.
- **Аутентификации нет** — приложение однопользовательское, данные глобальные.

В репозитории уже есть `docker-compose.yml`, `packages/api/Dockerfile`, `packages/web/Dockerfile`, `packages/web/nginx.conf` — но их нужно доработать (см. ниже).

---

## (A) ЧТО ОБЯЗАТЕЛЬНО ПОПРАВИТЬ ПЕРЕД ДЕПЛОЕМ

### A1. PostgreSQL + миграции (критично)
- В `packages/api/prisma/schema.prisma` сменить `datasource db { provider = "sqlite" }` → `"postgresql"`, `url = env("DATABASE_URL")`.
- **Существующие миграции сгенерированы под SQLite и НЕ применятся к Postgres.** Кроме того, папка `packages/api/prisma/migrations` сейчас в `.gitignore` (в git её нет). Варианты:
  - **Рекомендуется**: убрать `packages/api/prisma/migrations` из `.gitignore`, удалить старые SQLite-миграции, поднять временный Postgres, выполнить `prisma migrate dev --name init` (создаст Postgres-миграции), закоммитить их. В контейнере api при старте — `prisma migrate deploy`.
  - **Быстрый путь**: в команде старта api использовать `prisma db push` вместо `migrate deploy` (создаёт схему без файлов миграций). Подходит для первого запуска, но без истории миграций.
- Проверить, что JSON-в-строке поля (`tags`, `attendees`, `weekdays` и пр. хранятся как `String`) и `Float/Int/Boolean/DateTime` корректно мапятся на Postgres — да, тип `String` остаётся.

### A2. Dockerfile — копировать lockfile (критично)
Оба Dockerfile делают `pnpm install --frozen-lockfile`, но **не копируют `pnpm-lock.yaml`** перед install → сборка упадёт. Добавить `COPY pnpm-lock.yaml ./` (и копировать `package.json` всех нужных пакетов до install).

### A3. Том для загрузок + раздача /uploads (критично)
- Рабочая директория api в контейнере — `/app/packages/api`, файлы пишутся в `uploads/`. В `docker-compose.yml` добавить именованный том: `uploads:/app/packages/api/uploads` у сервиса api (иначе вложения теряются при пересоздании контейнера).
- В `packages/web/nginx.conf` добавить проксирование `location /uploads/ { proxy_pass http://api:3001; }` (сейчас проксируются только `/api/` и `/ws`) и `client_max_body_size 25m;` (лимит загрузки файла — 25 МБ).

### A4. Frontend env — это build-time, не runtime (важно)
- Vite подставляет `VITE_API_URL` / `VITE_WS_URL` **на этапе сборки**, поэтому задавать их как `environment:` у сервиса web в compose бесполезно — нужно передавать как **build args** в `packages/web/Dockerfile` (`ARG VITE_API_URL` → `ENV` перед `pnpm build`).
- Для единого домена за nginx правильно: `VITE_API_URL=""` (пустой → фронт ходит на тот же origin, nginx проксирует `/api`), а `VITE_WS_URL` — `wss://<домен>/ws` (или сделать в `packages/web/src/lib/ws.ts` построение URL от `window.location`, чтобы не зависеть от домена при сборке — предпочтительнее).

### A5. .dockerignore (важно)
Файла `.dockerignore` нет → в build-контекст попадают `node_modules`, `packages/api/prisma/dev.db`, `uploads`, `dist`. Создать `.dockerignore` с: `**/node_modules`, `**/dist`, `**/.vite`, `packages/api/prisma/dev.db`, `packages/api/uploads`, `.env`, `.git`.

### A6. nginx — WebSocket-заголовки (важно)
В `location /ws` добавить `proxy_set_header Host $host;` и при TLS — корректный `X-Forwarded-Proto`. Блок `Upgrade/Connection` уже есть.

### A7. TLS / домен (для прод)
Поставить перед web реверс-прокси с авто-HTTPS: **Caddy** (проще всего) или Traefik / nginx+certbot. Наружу открыть только 80/443; postgres и api держать во внутренней сети compose (убрать публичный `ports: 5432` и `3001` у postgres/api в проде).

### A8. Безопасность (важно)
Аутентификации нет — любой с доступом к URL видит все данные. На сервере **обязательно**: либо basic-auth на реверс-прокси, либо доступ только по VPN/whitelisted IP. (Полноценный auth-слой — отдельная задача.)

### A9. Секреты и интеграции
- `.env` на сервере (не коммитить): `DATABASE_URL`, `POSTGRES_USER/PASSWORD/DB`.
- Опционально (есть и в UI-настройках): `LLM_API_KEY`, `LLM_API_URL`, `LLM_MODEL`; для исходящего прокси `NODE_USE_ENV_PROXY=1` + `HTTPS_PROXY`/`HTTP_PROXY` (нужно, если сервер в РФ обращается к Telegram/Google).
- Убедиться, что `uploads/`, `.env`, `dev.db` в `.gitignore`.

### A10. Проверка после деплоя
`docker compose up -d --build` → дождаться healthy → `GET /health` = `{status:"ok"}` → открыть сайт, создать задачу/мероприятие, привычку, **заметку с вложением** (файл должен сохраниться в томе и открываться по `/uploads/...`), проверить WebSocket-обновления, проверить `prisma migrate status` в контейнере api. В ⚙ Настройках задать LLM-ключ (Gemini) и при необходимости proxy → «Проанализировать» в Статистике.

---

## (B) ГОТОВЫЙ ПРОМТ ДЛЯ DEVIN

> Скопируй текст ниже и передай Devin в корне репозитория.

```
Задача: подготовить монорепо (pnpm workspaces: packages/shared, packages/api — Fastify+Prisma,
packages/web — Vite+React) к продакшн-деплою на Linux-сервере через Docker Compose и развернуть.

Сделай по пунктам, в конце дай инструкцию запуска:

1) PostgreSQL: в packages/api/prisma/schema.prisma смени provider на "postgresql".
   Удали старые SQLite-миграции, убери packages/api/prisma/migrations из .gitignore,
   подними временный Postgres и сгенерируй заново `prisma migrate dev --name init`, закоммить миграции.
   В контейнере api при старте выполняй `prisma migrate deploy && node dist/server.js`.

2) Dockerfile (api и web): ОБЯЗАТЕЛЬНО копируй pnpm-lock.yaml перед `pnpm install --frozen-lockfile`.
   Собирай сначала @life-app/shared, затем целевой пакет. В api делай `prisma generate` на этапе сборки.

3) web Dockerfile: VITE_API_URL и VITE_WS_URL — это build-time переменные Vite, передавай их как build ARG.
   Для единого домена ставь VITE_API_URL="" (тот же origin), а WebSocket стройте от window.location
   (wss при https) в packages/web/src/lib/ws.ts, чтобы не зависеть от домена при сборке.

4) nginx (packages/web/nginx.conf): SPA-fallback есть; добавь проксирование location /uploads/ → api,
   client_max_body_size 25m, и для /ws заголовок Host. Проверь Upgrade/Connection для WebSocket.

5) docker-compose.yml: сервисы postgres (healthcheck pg_isready, том postgres_data),
   api (depends_on postgres healthy, env DATABASE_URL, **именованный том uploads:/app/packages/api/uploads**,
   healthcheck GET /health), web (build args для VITE_*, depends_on api).
   В проде не публикуй порты postgres(5432) и api(3001) наружу — только внутренняя сеть; наружу 80/443.

6) Загрузки файлов: убедись, что том uploads примонтирован и переживает пересоздание контейнера,
   а файлы доступны по /uploads/... через nginx.

7) .dockerignore: добавь **/node_modules, **/dist, **/.vite, packages/api/prisma/dev.db,
   packages/api/uploads, .env, .git.

8) TLS и домен: поставь Caddy (или Traefik) с авто-Let's Encrypt перед web, отдавай https + проксируй wss.

9) Безопасность: у приложения НЕТ аутентификации. Закрой доступ basic-auth на реверс-прокси
   или ограничь по IP/VPN. Опиши это в README деплоя.

10) Секреты: .env с DATABASE_URL и POSTGRES_*. Опционально LLM_API_KEY/LLM_API_URL/LLM_MODEL и
    NODE_USE_ENV_PROXY=1 + HTTPS_PROXY (если нужен прокси для Telegram/Google). Эти же интеграции
    можно задать в UI (⚙ Настройки, хранятся в БД).

Критерии готовности: `docker compose up -d --build` поднимает postgres+api+web (все healthy);
данные и загрузки переживают перезапуск (тома postgres_data и uploads); сайт открывается по https,
API и WebSocket работают через тот же origin; миграции применены (`prisma migrate status` чисто);
секретов нет в образе/репозитории.
```
