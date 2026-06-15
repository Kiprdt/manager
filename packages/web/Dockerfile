FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
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
