# API (NestJS + Prisma). Контекст сборки — корень монорепо (edu-platform/).
# Полный образ node:20 (bookworm) уже содержит OpenSSL/ca-certificates, поэтому
# apt-get не нужен — важно для билд-окружений без доступа к apt-зеркалам.
FROM node:20 AS base
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @edu/shared build
RUN pnpm --filter @edu/api exec prisma generate
RUN pnpm --filter @edu/api build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/api
EXPOSE 4000
# На старте применяем миграции, затем запускаем сервер.
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/apps/api/src/main.js"]
