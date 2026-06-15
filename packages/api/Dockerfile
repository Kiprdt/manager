# node:22 — pnpm 11.x использует встроенный node:sqlite (его нет в node:20).
FROM node:22-alpine AS base
# openssl нужен движку Prisma на Alpine (musl); pnpm ставим напрямую через npm
# (надёжнее corepack, без проблем с подписью в CI), версия фиксирована.
RUN apk add --no-cache openssl && npm install -g pnpm@11.5.1
WORKDIR /app

# Копируем все манифесты + lockfile (нужны для корректного --frozen-lockfile
# в pnpm-воркспейсе: lockfile содержит импортеры всех пакетов).
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/
COPY packages/web/package.json ./packages/web/

RUN pnpm install --frozen-lockfile

# Копируем исходники
COPY packages/shared ./packages/shared
COPY packages/api ./packages/api

# Собираем shared, затем api
RUN pnpm --filter @life-app/shared build
RUN pnpm --filter @life-app/api build

WORKDIR /app/packages/api

# Prisma generate нужен после копирования schema
RUN pnpm prisma generate

EXPOSE 3001

CMD ["sh", "-c", "pnpm prisma migrate deploy && node dist/server.js"]
