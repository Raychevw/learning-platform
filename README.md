# Studevo — университетская LMS

Учебная платформа дистанционного обучения: каталог курсов и уроков, задания с рубриками, сдача работ,
журнал оценок (ECTS A–FX), онлайн-занятия с чатом и демонстрацией экрана, академические группы,
журнал аудита.

Проект построен как **микросервисная система** с единой точкой входа и настоящей JWT-аутентификацией.

---

## Архитектура

```text
                        ┌──────────────────────────────┐
   React SPA  ────────▶ │  api-gateway :3000           │
   (Vite / nginx)       │  CORS whitelist, JWT verify, │
                        │  rate-limit, proxy           │
                        └───────┬──────────┬───────────┘
                                │          │
                 ┌──────────────▼──┐   ┌───▼──────────────────┐
                 │ auth-service    │   │ course-service :3001 │
                 │ :3003           │   │ каталог, уроки,      │
                 │ логин, JWT, RBAC│   │ вебинары             │
                 └───────┬─────────┘   └───┬──────────┬───────┘
                         │                 │          │
                 ┌───────▼──────┐   ┌──────▼──────┐   │
                 │ auth-db      │   │ course-db   │   │
                 └──────────────┘   └─────────────┘   │
                                                     │
                 ┌──────────────────┐   ┌────────────▼─────┐
                 │ assignment-svc   │   │ redis_broker     │
                 │ :3002 задания,   │◀──┤ события          │
                 │ сдачи, оценки,   │   │ course.published │
                 │ группы           │   └──────────────────┘
                 └───────┬──────────┘   ┌──────────────────┐
                         │              │ minio (S3)       │
                 ┌───────▼──────┐       └──────────────────┘
                 │ assignment-db│
                 └──────────────┘
```

**Принципы:**

- **Database-per-service** — у каждого сервиса своя PostgreSQL (course-db, assignment-db, auth-db).
- **Единая точка входа** — браузер общается только с gateway; внутренние сервисы не публикуются наружу.
- **Defense in depth** — JWT проверяется и на gateway, и в каждом сервисе (подпись общим `JWT_SECRET`).
- **Clean Architecture** — `domain` (сущности, стратегии, интерфейсы) → `application` (use cases) →
  `infrastructure` (TypeORM, Redis, S3, HTTP-клиенты) → `presentation` (контроллеры).
- **Паттерны GoF** — Strategy (расчёт оценки), Builder (`AssignmentBuilder`), Decorator
  (`Caching/LoggingCourseServiceDecorator`), Repository, DI.
- **Событийная интеграция** — публикация курса (`course.published`) через Redis Pub/Sub, идемпотентный consumer.
- **Graceful degradation** — синхронный вызов Course Service из Assignment Service имеет таймаут 2s и fallback.
- **Реальные файлы** — сдачи сохраняются в S3/MinIO или на диск (`STORAGE_DRIVER`), скачивание только для владельца/преподавателя.
- **Дедлайны и рубрики** — сервер фиксирует просрочку, автоматически применяет штраф 20%, проверяет каждый балл по критериям.
- **Зачисления** — связь `user ↔ group` в БД определяет группу студента в сдаче (без хардкода).
- **Серверный аудит** — отдельный `audit-service` пишет входы, изменения данных и отказы в доступе;
  администратор видит реальный журнал и статистику.

---

## Быстрый старт

### Вариант A — Docker (весь стек одной командой)

```bash
cp .env.example .env      # Windows: copy .env.example .env
docker compose up --build
```

| Что | Адрес |
|---|---|
| Приложение | http://localhost:8080 |
| API Gateway | http://localhost:3000/health |
| Swagger (course) | http://localhost:3001/api/docs |
| Swagger (assignment) | http://localhost:3002/api/docs |
| Swagger (auth) | http://localhost:3003/api/docs |
| Swagger (audit) | http://localhost:3004/api/docs |
| MinIO console | http://localhost:9001 |

Остановка: `docker compose down` (данные остаются в volumes), `docker compose down -v` — удалить данные.

### Вариант B — локально (Windows / PowerShell)

```powershell
.\start-all.ps1
# опции: -SkipBuild, -Infra local, -NoBrowser
```

Скрипт:
1. читает `.env` (создаёт из `.env.example`, если нет);
2. поднимает инфраструктуру (`-Infra auto` → docker compose, иначе локальный PostgreSQL);
3. собирает сервисы (`npm run build:services`);
4. запускает auth/course/assignment/gateway, ждёт `/health`, пишет логи в `logs/`;
5. запускает Vite и открывает http://localhost:5173.

Остановка: `.\stop-all.ps1` (или `.\stop-all.ps1 -Docker`, чтобы остановить и контейнеры).

### Требования

- Node.js **22+**, npm 10+
- Docker Desktop (для варианта A / `-Infra docker`) либо локальные PostgreSQL 15+ и Redis 7+
- Для локального режима создайте БД: `course_db`, `assignment_db`, `auth_db`
  (скрипт попытается сделать это через `psql`, если он есть в PATH).

---

## Демо-доступ

Аккаунты создаются `auth-service` при первом старте (пароли хранятся в bcrypt-хешах):

| Роль | Логин | Email | Пароль |
|---|---|---|---|
| Студент | `student` | o.petrenko@univ.edu.ua | `123456` |
| Преподаватель | `teacher` | d.kovalenko@univ.edu.ua | `123456` |
| Администратор | `admin` | dekanat.fiot@univ.edu.ua | `123456` |

Пароль задаётся `DEMO_PASSWORD` в `.env`. В production `SEED_DEMO_DATA=false`.

---

## Аутентификация и права

```http
POST /api/auth/login
{ "login": "teacher", "password": "123456" }

200 OK
{ "accessToken": "<jwt>", "tokenType": "Bearer", "expiresIn": "8h", "user": { ... } }
```

Далее все запросы: `Authorization: Bearer <jwt>`.

- JWT подписывается `JWT_SECRET` (HS256), срок — `JWT_EXPIRES_IN` (по умолчанию 8h).
- Gateway **удаляет** любые клиентские `x-user-*` заголовки и подставляет их из проверенного токена.
- Gateway ограничивает логин (20 попыток / 5 минут на IP) и CORS (`CORS_ORIGINS`).
- RBAC:

| Действие | Роли |
|---|---|
| Просмотр каталога, заданий, вебинаров | все аутентифицированные |
| Работа с собственными сдачами/оценками | студент видит только свои (фильтрация на сервере) |
| Создание/публикация курсов, модулей, уроков, вебинаров | teacher, admin |
| Создание заданий, выставление оценок | teacher, admin |
| Сдача работы | student (личность берётся из токена) |
| Группы, пользователи | admin |

---

## API (кратко)

| Метод | Путь | Назначение |
|---|---|---|
| POST | `/api/auth/login` | логин, выдача JWT (public) |
| GET | `/api/auth/me` | профиль по токену |
| GET/POST | `/api/auth/users` | список/создание пользователей (admin) |
| GET | `/api/catalog?userId=` | каталог с модулями, уроками, прогрессом |
| POST | `/api/catalog` | создать курс |
| POST | `/api/catalog/:courseId/modules` | добавить модуль |
| POST | `/api/catalog/modules/:moduleId/lessons` | добавить урок |
| POST | `/api/catalog/lessons/:id/toggle` | отметить урок пройденным |
| GET/POST | `/api/assignments-full` | задания со сдачами / создать |
| POST | `/api/assignments/:id/submit` | сдать работу (JSON, без файла) |
| POST | `/api/assignments/:id/submit-file` | сдать работу с файлом (`multipart/form-data`, поле `file`, до 25 МБ) |
| GET | `/api/submissions/:id/file` | скачать файл сдачи (владелец, teacher, admin) |
| GET/POST/DELETE | `/api/enrollments`, `/api/groups/:id/enroll`, `/api/groups/:id/enroll/:userId` | зачисления (admin) |
| GET | `/api/audit/logs?search=&status=&limit=` | журнал безопасности (admin) |
| GET | `/api/audit/stats` | агрегаты аудита (admin) |
| POST | `/audit/events` (internal) | приём событий от gateway по `x-audit-secret` |
| POST | `/api/grading/grade` | оценить (Strategy) |
| GET | `/api/grades` | журнал (студент — только свои) |
| GET/POST | `/api/groups` | группы |
| GET/POST | `/api/webinars` | вебинары |
| PATCH | `/api/webinars/:id/status` | статус эфира |
| POST | `/api/webinars/:id/chat` | сообщение в чат |

Полные спецификации: `contracts/*.json` (генерируются из Swagger) и `contracts/events-schema.json`.

---

## Проверки и тесты

```bash
npm run lint            # ESLint (фронтенд + скрипты)
npm run test            # Vitest: домен, стратегии, декораторы, идемпотентность
npm run build:all       # сборка сервисов + SPA
npm run verify:lab3     # архитектурная верификация (контракты, compose, fallback, события)
```

`verify:lab3` проверяет: наличие контрактов, database-per-service и брокер в compose,
собранные артефакты, срабатывание fallback при недоступном Course Service, идемпотентность
обработки `course.published`, а при запущенном стеке — живой `/health` и `/api/catalog`.

---

## Структура репозитория

```text
src/                     React SPA
  api/client.js          HTTP-клиент: /api, Bearer, ApiError, 401-событие
  auth/useAuth.js        JWT-сессия, профиль, авто-логаут
  data/seed.js           offline-демо данные (fallback, не источник истины)
  lib/id.js              генерация идентификаторов
  App.jsx                UI и состояние платформы
services/
  auth-service/          логин, bcrypt, JWT, RBAC          :3003
  course-service/        каталог, уроки, вебинары, S3      :3001
  assignment-service/    задания, сдачи, оценки, группы   :3002
  audit-service/         журнал безопасности и статистика  :3004
  api-gateway/           шлюз, JWT, CORS, rate-limit        :3000
contracts/               OpenAPI + JSON-схемы событий
scripts/verify-lab3.js   архитектурная верификация
infra/frontend/          Dockerfile + nginx для SPA
archive/backend-monolith ранее существовавший модульный монолит (не используется)
```

> `archive/backend-monolith` — прежняя реализация «всё в одном NestJS-приложении». Оставлена для
> истории и сравнения подходов; в сборке и запуске не участвует.

---

## Конфигурация

Все переменные — в `.env` (шаблон: `.env.example`). Ключевые:

| Переменная | Назначение | По умолчанию |
|---|---|---|
| `JWT_SECRET` | подпись JWT (заменить в prod!) | dev-значение |
| `JWT_EXPIRES_IN` | срок жизни токена | `8h` |
| `CORS_ORIGINS` | разрешённые origin через запятую | `localhost:5173,localhost:8080` |
| `DB_USER` / `DB_PASSWORD` | доступ к PostgreSQL | `lms` / `lms_secure_password` |
| `SEED_DEMO_DATA` | создавать демо-данные | `true` |
| `DEMO_PASSWORD` | пароль демо-аккаунтов | `123456` |
| `REDIS_HOST` / `REDIS_PORT` | брокер событий | `localhost:6379` |
| `STORAGE_DRIVER` | `local` (диск) или `s3` (MinIO) | `local` |
| `STORAGE_LOCAL_DIR` | каталог локального хранилища | `./storage/uploads` |
| `ALLOW_LATE_SUBMISSION` | принимать работы после дедлайна | `true` |
| `AUDIT_INGEST_TOKEN` | внутренний токен gateway → audit-service | = `JWT_SECRET` |
| `AUDIT_SERVICE_URL` | адрес audit-service | `http://localhost:3004` |
| `S3_*` | MinIO / S3 | `localhost:9000`, bucket `lms-files` |

`VITE_API_BASE` обычно пустой: фронт ходит на относительный `/api` (Vite proxy в dev, nginx в prod).

---

## Текущие ограничения

- **Миграции**: сервисы используют `synchronize: true` (удобно для учебной среды). Для production
  нужно перейти на TypeORM migrations и `synchronize: false`.
- **Real-time**: чат вебинара и «поднятая рука» синхронизируются между вкладками через
  `BroadcastChannel`; между устройствами нужен WebSocket/SSE + Redis-адаптер и WebRTC-сигналинг.
- **Загрузка файлов** работает для сдач; материалы уроков пока без вложений.
- **Фронтенд**: `App.jsx` остаётся крупным файлом (без роутера и feature-разбиения).

## Устранение неполадок

| Симптом | Причина / решение |
|---|---|
| «Не вдалося з’єднатися з сервером» | gateway не запущен; проверьте `logs/gateway.err.log`, `http://localhost:3000/health` |
| 401 после входа | истёк токен или разный `JWT_SECRET` у gateway и сервисов |
| Сервис не стартует | нет БД/Redis: `docker compose up -d course-db assignment-db auth-db redis_broker` |
| Порт занят | `.\stop-all.ps1` или `docker compose down` |
| Пустой каталог | `SEED_DEMO_DATA=false` или БД не создана; проверьте логи course-service |
| CORS-ошибка | добавьте origin в `CORS_ORIGINS` и перезапустите gateway |

Логи локального запуска: `logs/<service>.out.log` и `logs/<service>.err.log`.
Логи Docker: `docker compose logs -f <service>`.
