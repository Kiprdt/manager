FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
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
