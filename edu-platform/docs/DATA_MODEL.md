# Модель данных

Определена в `apps/api/prisma/schema.prisma` (PostgreSQL). Ниже — ключевые
сущности и связи.

## Пользователи и доступ
- **User** — `email`, `passwordHash`, имя, `roles: Role[]`, `avatarUrl`, `isActive`.
- **OAuthAccount** — привязка внешнего провайдера (`google`/`vk`) к пользователю.
- **RefreshToken** — `sha256`-хэш refresh-токена, срок, отзыв (ротация).
- **ParentLink** — связь многие-ко-многим родитель ↔ ученик.

## Курсы и контент
- **Course** — `title`, `slug`, `status` (DRAFT/PUBLISHED/ARCHIVED), `authorId`,
  `callDurationMinutes` (фикс. длительность созвона на курс), `callsPerStudent` (квота).
- **Lesson** — принадлежит курсу; `content` (JSON = `LessonDocument`), `order`
  (уникален в пределах курса), `isPublished`.
- **Homework** — раздел с ДЗ, привязан к курсу и опционально к уроку; `maxScore`.

## Обучение
- **Enrollment** — ученик ↔ курс; `teacherId` (закреплённый учитель),
  `callsTotal`/`callsUsed` (слепок и расход квоты). Уникально `(courseId, studentId)`.
- **LessonProgress** — прогресс ученика по уроку (NOT_STARTED/IN_PROGRESS/COMPLETED).
- **Submission** — сдача ДЗ: `content` (JSON), `status`
  (DRAFT/SUBMITTED/RETURNED/GRADED), `score`, `reviewedById`. Уникально `(homeworkId, studentId)`.

## Коммуникации
- **Comment** — полиморфный комментарий (урок / домашка / сдача) с тредами (`parentId`).
- **ChatThread / ChatMessage** — личный чат ученик↔учитель.
- **SupportTicket / TicketMessage** — обращения в поддержку наставнику.

## Созвоны
- **AvailabilityRule** — правило доступности сотрудника (день недели + интервал в
  минутах), настраивается автором.
- **Call** — конкретный слот: `teacherId`, опц. `studentId`/`courseId`, `startsAt`,
  `durationMinutes`, `status` (AVAILABLE/BOOKED/COMPLETED/CANCELLED), `joinUrl`.

## Сервисные
- **MediaAsset** — метаданные загруженного медиа (kind, url, storageKey, mime, size).
- **AuditLog** — `actorId`, `action`, `entityType`/`entityId`, `metadata`, `ip`, время.
- **Notification** — уведомления пользователю (задел для рассылок/пушей).

## Инварианты
- Квота созвонов: бронирование увеличивает `Enrollment.callsUsed`, но не выше
  `callsTotal`; отмена возвращает единицу.
- Проверять ДЗ может только учитель, закреплённый за учеником на курсе.
- Балл при выставлении оценки ограничен диапазоном `0..Homework.maxScore`.
- Ровно одна цель у комментария (урок / домашка / сдача).
