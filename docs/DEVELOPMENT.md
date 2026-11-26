# ЦветоТишина — инструкция для разработчика

## Стек и структура

- TypeScript, React 19, Vite, React Router, TanStack Query;
- NestJS 11, Prisma 6, PostgreSQL 16+;
- Redis 7, BullMQ, отдельный worker;
- Nginx с двумя API-репликами и `least_conn`;
- Prometheus и Grafana;
- встроенный `node:test` и Playwright.

```text
apps/web              витрина и /admin
apps/api              публичный API и admin API
apps/worker           outbox, BullMQ, retry/DLQ, очистка заказов
packages/shared       статусы, общие типы и форматирование денег
apps/api/prisma       схема, миграции и seed
infra/nginx           reverse proxy и rate limit
infra/prometheus      конфигурация сбора метрик
infra/grafana         provisioning дашборда
tests/e2e             API и браузерные сценарии
```

API — модульный монолит с явными границами `Catalog`, `Auth`, `Orders`, `Admin`, `Common`. Worker — независимый процесс. Витрина не знает Prisma, worker не вызывает API синхронно.

## Локальная разработка

Требуется Node.js 22.12+, PostgreSQL 16+ и Redis 7+.

```bash
npm ci
cp .env.example .env
# заполните .env
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

По умолчанию:

- web: `http://localhost:5173`;
- API: `http://localhost:3000`;
- worker health: `http://localhost:3001/health/ready`;
- worker metrics: `http://localhost:3001/metrics`.

`ConfigModule` читает корневой `.env`; уже экспортированные переменные окружения имеют приоритет. Для другого порта API задайте `API_PORT` и `VITE_API_PROXY_TARGET`. Vite проксирует `/api` и `/uploads` на API.

Полезные команды:

```bash
npm test
npm run build
npm run test:api
npm run test:e2e
npm run docker:up
npm run docker:logs
```

При изменении Prisma-схемы:

```bash
npm run db:migrate
npm run db:generate
npm run db:seed
```

Seed использует `upsert` и не перезаписывает существующие товары. Пароль администратора создаётся только при первом seed; дальнейшая смена — через админку.

## Переменные окружения

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | PostgreSQL DSN для API, worker, миграций и seed |
| `REDIS_URL` | Redis для кэша, rate limit и BullMQ |
| `API_PORT` | Порт API; в Docker — 3000 |
| `WORKER_PORT` | Порт health/metrics worker; в Docker — 3001 |
| `WEB_ORIGIN` | Точный origin браузера без завершающего `/`; проверяется для мутаций |
| `JWT_SECRET` | Секрет HS256 access-токена, минимум 32 символа |
| `ADMIN_EMAIL` | Почта первого администратора |
| `ADMIN_PASSWORD` | Пароль первого администратора, минимум 12 символов |
| `UPLOAD_DIR` | Каталог загруженных изображений |
| `DEMO_MODE` | Показывает демо-режим в витрине |
| `COOKIE_SECURE` | `true` только за HTTPS; для локального HTTP — `false` |
| `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` | Доступ к Grafana |

Секреты не коммитятся. `.env` добавлен в `.gitignore`. В production используйте менеджер секретов, а не файл на диске.

## Модель данных

- `Category`, `Product` — каталог; деньги в копейках, `version` для optimistic locking;
- `Order`, `OrderItem` — снимок названия, цены и изображения на момент заказа;
- `OrderStatusHistory`, `PaymentAttempt` — история статусов и демо-платежи;
- `IdempotencyRecord` — уникальность `(scope, key)` и сохранённый ответ;
- `OutboxEvent` — транзакционная публикация событий;
- `AdminUser`, `RefreshToken`, `AdminAuditLog` — сессии и аудит;
- `Notification` — идемпотентные демо-уведомления без внешней отправки.

Статусы: `AWAITING_PAYMENT → NEW → ASSEMBLING → DELIVERING → DELIVERED`. Дополнительно: `PAYMENT_FAILED`, `CANCELLED`. Отмена возвращает остатки. Неоплаченные заказы отменяет worker через 30 минут.

## API

Публичный prefix `/api/v1`:

- `GET /config`, `/categories`, `/products`, `/products/:slug`;
- `POST /cart/quote`;
- `POST /orders` с обязательным `Idempotency-Key`;
- `GET /orders/:number?token=...`;
- `POST /orders/:number/payments/demo` с `Idempotency-Key`.

Admin prefix `/api/v1/admin`:

- `POST /auth/login`, `/auth/refresh`, `/auth/logout`; `GET /auth/me`; `POST /auth/change-password`;
- CRUD `/products`, `/categories`; `POST /uploads`;
- `GET /orders`, `GET /orders/:id`, `PATCH /orders/:id/status`;
- `GET /dashboard`.

Мутации админки требуют `X-CSRF-Token`; смена статуса — `If-Match: <version>`. Access и refresh хранятся в HttpOnly cookie. CSRF cookie доступен JavaScript. Ошибки имеют формат RFC 7807 и `requestId`.

Токен покупателя хранится в базе только как SHA-256. В логи не пишутся тело запроса, query string, телефон и токены.

## Надёжность

- **Кэш:** cache-aside, TTL 5 минут + джиттер, ключи `catalog:v2:*`, инвалидация после изменений каталога и остатков. При отказе Redis чтение идёт из PostgreSQL.
- **Идемпотентность:** создание заказа и демо-оплата сохраняют hash тела и ответ в одной транзакции. Тот же ключ с другим телом даёт 409.
- **Остатки:** атомарный `UPDATE ... WHERE stock >= quantity` внутри транзакции; при нехватке вся транзакция откатывается.
- **Outbox:** заказ и событие создаются вместе. Worker захватывает события через `FOR UPDATE SKIP LOCKED`, публикует их в BullMQ. Просроченная блокировка позволяет восстановиться после падения.
- **Retry/DLQ:** 5 попыток с exponential backoff; окончательные ошибки попадают в `order-events-dlq`. Outbox после 5 неудачных публикаций получает `DEAD`.
- **Circuit breaker:** Redis и платёжный адаптер; Redis использует fallback, платёжный адаптер быстро возвращает ошибку.
- **Graceful shutdown:** Nest shutdown hooks закрывают Prisma, Redis, worker и очереди. Compose задаёт `stop_grace_period`.

Compose запускает две API-реплики за Nginx. Проверка конфигурации: `docker compose config`. Проверка реплик: `docker compose ps api`.

## Безопасность

- Argon2id для паролей, JWT HS256 с коротким access-токеном;
- ротация refresh-токенов и revocation при смене пароля;
- CSRF double-submit, SameSite cookie, Origin/Sec-Fetch-Site проверка;
- rate limit входа в Nginx и Redis;
- whitelist DTO, ограничение размера загрузки и проверка сигнатур JPG/PNG/WebP;
- случайные имена файлов, запрет SVG;
- security headers в Nginx и API;
- optimistic locking и аудит административных действий.

Перед production обязательны HTTPS, `COOKIE_SECURE=true`, внешний secret manager, ограничение доступа к PostgreSQL/Redis/Prometheus/Grafana и регулярные обновления.

## Мониторинг

- API: `/health/live`, `/health/ready`, `/metrics`;
- worker: `/health/live`, `/health/ready`, `/metrics`;
- Grafana dashboard: «ЦветоТишина — эксплуатация».

Основные метрики: RPS и p95 по маршрутам, доля 5xx, созданные/оплаченные заказы, выручка, cache hit/miss/bypass, ошибки Redis, outbox pending/dead, состояние очереди и DLQ, обработанные/неуспешные события.

Readiness API требует PostgreSQL, но сохраняет готовность при отказе Redis, поскольку каталог имеет DB-fallback. Readiness worker требует и PostgreSQL, и Redis.

## Тестирование

`npm test` — `node:test`: цены, доставка, статусы, корзина, circuit breaker, JWT, slug, загрузка изображений.

`npm run test:api` — Playwright request-тесты против работающего API: каталог, идемпотентность, остатки, токен заказа, демо-оплата, CSRF, optimistic locking, валидация и файлы.

`npm run test:e2e` — браузерные сценарии витрины, checkout и админки. Перед запуском установите браузер:

```bash
npx playwright install chromium
```

API-тесты можно направить на другой адрес через `E2E_BASE_URL`. Учётные данные тестового администратора: `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD`.

## Docker

```bash
cp .env.example .env
# заполните .env
docker compose config
docker compose up --build -d --wait
docker compose ps
docker compose logs -f api worker
```

Сервисы: `migrate`, `api` ×2, `worker`, `web`, `nginx`, `postgres`, `redis`, `prometheus`, `grafana`. Nginx слушает 8080, Prometheus 9090, Grafana 3002. Том `uploads` общий для API и Nginx.

Образы API/worker устанавливают только соответствующие workspaces. API runtime сохраняет Prisma CLI и seed-зависимости, потому что одноразовый `migrate` применяет миграции и seed.

## Результаты текущей проверки

- `npm audit` — 0 уязвимостей;
- `npm test` — 19/19 модульных тестов;
- `npm run build` — shared, API, worker и web собираются без ошибок;
- Playwright — 7/7 сценариев: API, витрина, checkout, демо-оплата, админка и мобильная корзина;
- при остановленном Redis каталог читается из PostgreSQL, readiness API остаётся успешным, создание заказа и демо-оплата работают;
- при остановленном worker заказ создаётся, а после запуска outbox-событие получает `PUBLISHED` и создаёт демо-уведомление;
- `docker compose config` проходит; сам Docker Engine на машине разработчика не запускался по решению пользователя из-за ошибки служебного WSL-диска.

## Известные ограничения демо

- настоящие платежи, доставка и уведомления не подключены;
- контакты и юридические страницы отсутствуют;
- Compose на одном хосте не даёт HA для PostgreSQL и Redis;
- нагрузочная проверка на целевом железе и реальные SLA не выполнены;
- фото и каталог демонстрационные.
