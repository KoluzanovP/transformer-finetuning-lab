# API (NestJS + Prisma). Контекст сборки — корень монорепо (edu-platform/).
FROM node:20-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
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
