# Развёртывание на Timeweb Cloud — пошагово

Проект — это два приложения (API на NestJS и веб на Next.js) + PostgreSQL.
Всё упаковано в Docker и поднимается одной командой через `docker-compose.prod.yml`,
за единым входом nginx.

Схема: браузер → **nginx** (порт 80/443) → `web` (Next.js :3000) и `api` (NestJS :4000) → **PostgreSQL**.

Рекомендуемый путь — **облачный сервер (VPS) + Docker Compose**. Ниже он подробно,
а в конце — опции с управляемой БД и S3 от Timeweb.

---

## Что понадобится
- Аккаунт Timeweb Cloud (https://timeweb.cloud).
- Домен (можно купить там же) — например `edu.example.ru`.
- 20 минут.

---

## Шаг 1. Создать облачный сервер
1. В панели Timeweb Cloud: **Облачные серверы → Создать**.
2. ОС: **Ubuntu 24.04**.
3. Конфигурация: минимум **2 vCPU / 4 ГБ RAM / 40 ГБ NVMe** (для сборки образов
   комфортнее 4 ГБ+). Регион — ближайший.
4. Задайте пароль root или добавьте свой SSH-ключ. Создайте сервер и запишите его **IP**.

## Шаг 2. Привязать домен
1. Панель: **Домены и DNS** (или у вашего регистратора).
2. Добавьте **A-запись**: `edu` → IP вашего сервера. И при желании `@`/`www`.
3. Подождите распространения DNS (обычно минуты).

## Шаг 3. Подключиться и установить Docker
Подключитесь по SSH:
```bash
ssh root@ВАШ_IP
```
Установите Docker и плагин compose:
```bash
apt update && apt install -y curl git
curl -fsSL https://get.docker.com | sh
docker version && docker compose version   # проверка
```

## Шаг 4. Получить код
Если репозиторий приватный на GitHub — сгенерируйте на сервере ключ и добавьте его
в GitHub (Deploy keys), либо клонируйте по HTTPS с токеном. Затем:
```bash
git clone https://github.com/koluzanovp/edu-platform.git
cd edu-platform
```

## Шаг 5. Настроить переменные окружения
```bash
cp .env.production.example .env
nano .env
```
Обязательно заполните:
- `POSTGRES_PASSWORD` — надёжный пароль БД.
- `DATABASE_URL` — по умолчанию уже указывает на контейнер `db` (подставьте тот же пароль).
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — длинные случайные строки. Сгенерировать:
  ```bash
  openssl rand -hex 32   # выполните дважды, вставьте два разных значения
  ```
- `WEB_ORIGIN` — `https://edu.ваш-домен.ru` (ваш домен).
- `NEXT_PUBLIC_API_URL` — оставьте **пустым** (фронт и API на одном домене за nginx).

Остальное (S3, OAuth) — по желанию, позже.

## Шаг 6. Запустить
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
Первая сборка идёт несколько минут (скачивает базовые образы, ставит зависимости,
собирает фронт и бэк). Миграции БД применяются автоматически при старте `api`.

Проверка:
```bash
docker compose -f docker-compose.prod.yml ps            # все сервисы healthy/up
curl http://localhost/api/health                        # {"status":"ok","db":"ok",...}
```
Откройте в браузере `http://ВАШ_IP` — увидите страницу входа.

## Шаг 7. Создать администратора и (по желанию) демо-курсы
Первого **автора платформы** заводим командой (публичная регистрация автора закрыта):
```bash
docker compose -f docker-compose.prod.yml exec api pnpm admin:create admin@ваш-домен.ru 'ВашНадёжныйПароль1'
```
Если хотите сразу наполнить платформу готовыми курсами математики:
```bash
docker compose -f docker-compose.prod.yml exec api pnpm seed        # демо-пользователи всех ролей
docker compose -f docker-compose.prod.yml exec api pnpm seed:math   # курс «Математика: с нуля до ЕГЭ»
docker compose -f docker-compose.prod.yml exec api pnpm seed:ege    # 8 пробных вариантов ЕГЭ
```
> Демо-аккаунты имеют пароль `password123` — на проде либо не запускайте `seed`,
> либо сразу смените/деактивируйте эти учётки.

## Шаг 8. Включить HTTPS (SSL)
Проще всего — получить сертификат Let's Encrypt на сервере и добавить его в nginx.
Быстрый способ через certbot в контейнере:
```bash
# домен уже должен указывать на сервер (шаг 2), порт 80 открыт
docker run --rm -p 80:80 -v /etc/letsencrypt:/etc/letsencrypt \
  certbot/certbot certonly --standalone -d edu.ваш-домен.ru --agree-tos -m you@mail.ru -n
```
Затем добавьте в `deploy/nginx.conf` серверный блок на 443 с
`ssl_certificate /etc/letsencrypt/live/edu.ваш-домен.ru/fullchain.pem;` и
`ssl_certificate_key .../privkey.pem;`, пробросьте `443:443` и том
`/etc/letsencrypt:/etc/letsencrypt:ro` в сервис `nginx`, перезапустите:
```bash
docker compose -f docker-compose.prod.yml up -d
```
**Альтернатива без возни:** в Timeweb Cloud создайте **Балансировщик** с
SSL-терминацией и направьте его на порт 80 вашего сервера — сертификат выпустит и
продлит сам Timeweb.

## Шаг 9. Финальная проверка
- Откройте `https://edu.ваш-домен.ru`, войдите как администратор.
- Проверьте, что создаются курсы/уроки, грузятся медиа, проходятся тесты.
- На телефоне: «Добавить на главный экран» (PWA).

---

## Опция A. Управляемая PostgreSQL от Timeweb (вместо контейнера)
Надёжнее для продакшена (бэкапы, мониторинг «из коробки»).
1. Панель: **Базы данных → Создать → PostgreSQL 16**.
2. Скопируйте строку подключения, впишите в `.env` как `DATABASE_URL`
   (обычно нужен `?sslmode=require`).
3. В `docker-compose.prod.yml` удалите сервис `db` и блок `depends_on: db` у `api`.
4. `docker compose -f docker-compose.prod.yml up -d --build`.

## Опция B. S3-хранилище Timeweb для медиа (вместо диска)
Чтобы видео/фото уроков не занимали диск сервера и раздавались быстрее.
1. Панель: **S3-хранилище → Создать бакет**, получите ключи доступа.
2. В `.env`: `STORAGE_DRIVER=S3`, заполните `S3_ENDPOINT` (напр. `https://s3.timeweb.cloud`),
   `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
   `S3_PUBLIC_BASE_URL` (публичный URL бакета).
3. Перезапустите `api`. Загрузка медиа пойдёт через presigned-URL в бакет.

---

## Обновление версии
```bash
cd edu-platform
git pull
docker compose -f docker-compose.prod.yml up -d --build
```
Миграции применятся автоматически.

## Резервные копии
- База (контейнер):
  ```bash
  docker compose -f docker-compose.prod.yml exec db pg_dump -U edu edu_platform > backup_$(date +%F).sql
  ```
  (управляемая БД Timeweb делает бэкапы сама).
- Медиа при `STORAGE_DRIVER=LOCAL` лежат в томе `uploads` — забэкапьте его или перейдите на S3.

## Мониторинг и логи
```bash
docker compose -f docker-compose.prod.yml logs -f api    # логи API
docker compose -f docker-compose.prod.yml logs -f web    # логи фронта
curl https://edu.ваш-домен.ru/api/health                 # состояние API и БД
```

## Частые проблемы
- **Сборка падает из-за памяти** — возьмите сервер с 4 ГБ RAM или добавьте swap.
- **CORS-ошибки в браузере** — проверьте, что `WEB_ORIGIN` совпадает с адресом сайта
  (со схемой https), и что `NEXT_PUBLIC_API_URL` пуст (единый домен).
- **502 от nginx** — контейнер `api`/`web` ещё поднимается; посмотрите `logs`.
- **Не входит автор** — создайте его командой `admin:create` (шаг 7).
