# EduPlatform — образовательная платформа

Платформа для онлайн-обучения с пятью типами личных кабинетов: **автор платформы,
учитель, наставник, ученик, родитель**. Авторы собирают курсы из уроков в
редакторе в стиле Jupyter Notebook (текст, фото, видео, аудио, код, тесты),
создают домашние задания, назначают учителей и настраивают расписание созвонов.
Ученики проходят курсы, сдают домашки и бронируют 30-минутные созвоны; учителя
проверяют работы и ведут созвоны; наставники отвечают на вопросы по платформе;
родители следят за прогрессом детей.

## Готовый курс

В комплекте — флагманский курс **«Математика: с нуля до ЕГЭ»** (`seed:math`):
8 модулей, 24 урока, 16 домашних заданий, ~390 блоков контента и ~140
тестовых вопросов. Объяснения «как для чайника», формулы (KaTeX), наглядные
SVG-схемы, жизненные примеры. Темы: натуральные числа → дроби → отрицательные
числа → уравнения → проценты/степени/корни → функции и графики → квадратные
уравнения → тригонометрия и подготовка к ЕГЭ.

## Технологии

| Слой | Технология |
|------|------------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS |
| Backend | NestJS 10, TypeScript |
| ORM / БД | Prisma + PostgreSQL 16 |
| Авторизация | JWT (access + refresh с ротацией), bcrypt; OAuth Google/VK — задел |
| Медиа | Cloudflare R2 / AWS S3 (в dev — локальная заглушка) |
| Созвоны | Расписание + внешние ссылки (Zoom/Meet), генерация join-ссылки |
| Монорепо | pnpm workspaces |

## Структура

```
edu-platform/
├── apps/
│   ├── api/          # NestJS backend (REST /api)
│   │   ├── prisma/   # схема, миграции, seed
│   │   ├── src/      # модули: auth, users, courses, lessons, homework,
│   │   │             #   enrollments, submissions, comments, chat,
│   │   │             #   scheduling, tickets, media, analytics
│   │   └── test/     # e2e-сценарий
│   └── web/          # Next.js frontend (кабинеты всех ролей)
│       └── src/
│           ├── app/          # маршруты по ролям: author/ teacher/ mentor/ student/ parent/
│           ├── components/   # DashboardShell, NotebookEditor, NotebookViewer
│           └── lib/          # api-клиент, auth-контекст, типы
├── packages/
│   └── shared/       # общие роли, enum'ы, модель notebook-блоков, DTO
└── docs/             # ARCHITECTURE, ROLES, DATA_MODEL, API, ROADMAP
```

## Быстрый старт

Требуется Node ≥ 20, pnpm ≥ 9, PostgreSQL 16 (или `docker compose up -d db`).

```bash
# 1. Зависимости
pnpm install

# 2. Поднять БД (Docker) — либо используйте свой PostgreSQL
pnpm db:up

# 3. Настроить окружение API
cp .env.example apps/api/.env         # при необходимости поправьте DATABASE_URL

# 4. Применить схему и залить демо-данные
pnpm --filter @edu/api prisma:deploy  # или prisma:migrate для dev
pnpm --filter @edu/api seed           # демо-пользователи и учётки всех ролей
pnpm --filter @edu/api seed:math      # флагманский курс «Математика: с нуля до ЕГЭ»

# 5. Запуск (в двух терминалах или через корневой dev)
pnpm --filter @edu/api dev            # http://localhost:4000/api
cp apps/web/.env.local.example apps/web/.env.local
pnpm --filter @edu/web dev            # http://localhost:3000
```

### Демо-аккаунты (пароль у всех — `password123`)

| Роль | Email |
|------|-------|
| Автор платформы | author@edu.dev |
| Учитель | teacher@edu.dev |
| Наставник | mentor@edu.dev |
| Ученик | student@edu.dev |
| Родитель | parent@edu.dev |

## Тесты

```bash
pnpm --filter @edu/api test       # unit (RBAC-guard'ы)
pnpm --filter @edu/api test:e2e   # e2e: полный сквозной сценарий по всем ролям (21 тест)
pnpm --filter @edu/web test:e2e   # Playwright UI-smoke (нужны запущенные API и web)
```

e2e поднимает приложение против БД `edu_platform_test` и прогоняет сценарий:
регистрация всех ролей → создание курса/урока/домашки → зачисление → сдача и
проверка ДЗ → прогресс → бронирование созвона → тикет наставнику → комментарии →
аналитика и аудит → проверки прав доступа (RBAC).

## Документация

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — архитектура и модули
- [docs/ROLES.md](docs/ROLES.md) — роли и матрица прав
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md) — модель данных
- [docs/API.md](docs/API.md) — справочник REST API
- [docs/SECURITY.md](docs/SECURITY.md) — меры безопасности
- [docs/ROADMAP.md](docs/ROADMAP.md) — что дальше (оплата, видеозвонки, e-mail)
