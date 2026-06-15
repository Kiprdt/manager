# node:22 — pnpm 11.x использует встроенный node:sqlite (его нет в node:20).
FROM node:22-alpine AS builder
# pnpm ставим напрямую через npm (надёжнее corepack в CI), версия фиксирована.
RUN npm install -g pnpm@11.5.1
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/web/package.json ./packages/web/
COPY packages/api/package.json ./packages/api/

RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY packages/web ./packages/web

# VITE_* подставляются на этапе сборки → передаём как build-args.
ARG VITE_API_URL=''
ARG VITE_WS_URL=''
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

RUN pnpm --filter @life-app/shared build
RUN pnpm --filter @life-app/web build

FROM nginx:alpine AS runtime
COPY --from=builder /app/packages/web/dist /usr/share/nginx/html
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
