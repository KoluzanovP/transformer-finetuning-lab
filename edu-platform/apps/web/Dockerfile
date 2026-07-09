# Web (Next.js). Контекст сборки — корень монорепо (edu-platform/).
FROM node:20-bookworm-slim AS base
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @edu/shared build
# Публичный адрес API. Пусто = обращения к тому же домену (/api),
# когда фронт и API за одним nginx. Иначе — https://api.ваш-домен.
ARG NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @edu/web build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/web
# Публичный сервис. App Platform по умолчанию проксирует внешние 80/443 на 8080.
EXPOSE 8080
CMD ["pnpm", "exec", "next", "start", "-p", "8080"]
