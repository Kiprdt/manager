# Life Manager

Монорепозиторий приложения для управления жизнью.  
Модуль 1: **Календарь + менеджер задач** с блоками времени и реалтайм-синхронизацией.

## Стек

| Слой | Технологии |
|------|-----------|
| Монорепо | pnpm workspaces |
| Фронтенд | React 18, TypeScript, Vite, FullCalendar, TanStack Query, Zustand |
| Бэкенд | Node.js, Fastify 4, TypeScript, Prisma, Zod |
| БД | SQLite (dev) → PostgreSQL (prod, через Docker) |
| Realtime | WebSocket (`@fastify/websocket`) |
| Повторы | rrule (RFC 5545) |

## Быстрый старт (локально, без Docker)

```bash
# 1. Зависимости
pnpm install

# 2. Миграция (создаёт packages/api/dev.db)
pnpm --filter api prisma migrate dev

# 3. Бэкенд (в отдельном терминале)
pnpm --filter api dev

# 4. Фронтенд (в отдельном терминале)
pnpm --filter web dev
```

- Фронтенд: http://localhost:5173  
- API: http://localhost:3001  
- Healthcheck: http://localhost:3001/health

## Переменные окружения

Скопируй `.env.example` в `.env` — для локального запуска без изменений готов к работе:

```bash
cp .env.example .env
```

`.env` по умолчанию:
```
DATABASE_URL="file:./dev.db"
PORT=3001
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

## Запуск через Docker Compose (для деплоя с PostgreSQL)

```bash
cp .env.example .env   # при необходимости задать POSTGRES_PASSWORD
docker compose up --build
```

Приложение: http://localhost:5173

## REST API

### Tasks

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/tasks?status=TODO&limit=50` | Список |
| GET | `/api/tasks/:id` | По ID |
| POST | `/api/tasks` | Создать |
| PATCH | `/api/tasks/:id` | Обновить |
| DELETE | `/api/tasks/:id` | Удалить |

### TimeBlocks

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/timeblocks?from=ISO&to=ISO` | В диапазоне дат |
| GET | `/api/timeblocks/:id` | По ID |
| POST | `/api/timeblocks` | Создать |
| PATCH | `/api/timeblocks/:id` | Обновить (drag-and-drop) |
| DELETE | `/api/timeblocks/:id` | Удалить |

### WebSocket

`ws://localhost:3001/ws` — события при любом изменении Task/TimeBlock:
```json
{ "type": "task.created",      "payload": { ...Task } }
{ "type": "task.updated",      "payload": { ...Task } }
{ "type": "task.deleted",      "payload": { "id": "..." } }
{ "type": "timeblock.created", "payload": { ...TimeBlock } }
{ "type": "timeblock.updated", "payload": { ...TimeBlock } }
{ "type": "timeblock.deleted", "payload": { "id": "..." } }
```

## Команды

```bash
pnpm --recursive typecheck          # проверка типов
pnpm lint                           # ESLint
pnpm format                         # Prettier
pnpm --filter api prisma studio     # GUI для БД
pnpm --filter api prisma migrate dev --name <name>  # новая миграция
```

## Добавление нового модуля

1. Схема → `packages/shared/src/schemas/<module>.ts`
2. Модель → `packages/api/prisma/schema.prisma` + `migrate dev`
3. Роуты + сервис → `packages/api/src/modules/<module>/`
4. Одна строка в `server.ts`: `server.register(routes, { prefix: '/api/<module>' })`
5. TanStack Query хуки → `packages/web/src/api/<module>.ts`
