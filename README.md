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
- **Realtime** — чат и статус вебинара приходят по SSE через шлюз (`/api/webinars/stream`),
  поэтому обновления видны между устройствами, а не только между вкладками.
- **Онлайн-заняття через зовнішні конференції** — для кожного вебінару викладач додає
  посилання на Google Meet / Zoom / Teams; студент відкриває його кнопкою «Приєднатися».
- **Вбудована WebRTC-кімната** прибрана з інтерфейсу; заняття відкриваються лише за зовнішнім
  посиланням. Відповідні бекенд-ендпоінти залишені, але фронтенд їх не використовує.
- **Здача робіт файлом** — студент завантажує PDF/DOCX (або інший дозволений формат), викладач
  бачить файл, оцінює за рубрикою та залишає відгук; формат перевіряється на сервері.
- **Только реальные участники** — ростер вебинара строится из пользователей и зачислений
  (`GET /api/enrollments?courseId=`), без выдуманных студентов и счётчиков.
- **Особистий кабінет студента** — профіль (факультет, спеціальність, група, семестр), розклад,
  предмети, завдання зі статусами, оцінки/борги та онлайн-заняття з реальних даних.
- **Кабінет викладача** — дисципліни, кількість студентів, найближчі пари, роботи на перевірку,
  статистика успішності; матеріали з файлами (PDF/Word/PPT/відео), посиланнями та відео;
  завдання з датою відкриття, дедлайном і дозволеними форматами відповіді.
- **Кабінет деканату** — аналітика успішності (борги, пропущені роботи, не перевірені роботи,
  середній бал по групах), керування користувачами, створення акаунтів і переведення між групами,
  перегляд відомостей та експорт звіту CSV. Деканат не оцінює роботи студентів — це роблять лише
  викладачі (сервер повертає 403 на `POST /api/grading/grade`).
- **Власність курсів** — викладач бачить і редагує лише свої дисципліни; декан призначає
  відповідального викладача (`PATCH /api/catalog/:courseId/owner`).
- **Повідомлення** — окремий `communication-service`: діалоги студент ↔ викладач ↔ деканат,
  непрочитані, позначка «прочитано», відповідь у потоці, довідник користувачів.
- **Мій профіль** — кожен користувач редагує ПІБ, email, логін і підрозділ та змінює пароль
  (`PATCH /api/auth/me`, `POST /api/auth/change-password`).
- **Керування користувачами** — деканат створює акаунти, редагує дані, роль і статус навчання
  та скидає пароль (`PATCH /api/auth/users/:id`, `POST /api/auth/users/:id/password`).
- **Оголошення** — деканат/викладач публікує для всіх, студентів, викладачів або окремої
  групи; показуються на панелі та окремій сторінці.
- **Керування розкладом** — викладач/декан додає та видаляє пари (день, час, аудиторія,
  тип, посилання на онлайн) з окремої сторінки.
- **Куратори та статус навчання** — декан призначає куратора групи та змінює статус
  студента (навчається / відрахований / академвідпустка); неактивні акаунти не можуть увійти.
- **Миграции** — схема управляется TypeORM migrations (`synchronize: false`, `migrationsRun: true`);
  свежие БД создаются автоматически, существующие переводятся через `npm run db:baseline`.

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
| Swagger (messages) | http://localhost:3005/api/docs |
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

### Миграции и существующие БД

Схема сервисов управляется TypeORM-миграциями: `synchronize: false`, `migrationsRun: true`.
Начальная миграция (`Init1730000000000`) лежит в `services/*/src/database/migrations/`.

- **Новая/пустая БД** — схема создастся автоматически при первом старте сервиса.
- **БД из предыдущей версии проекта** (таблицы уже есть) — один раз выполните:

  ```bash
  npm run db:baseline           # локальный PostgreSQL
  npm run db:baseline:docker    # контейнеры compose (порты 5433–5436)
  ```

  Скрипт создаёт таблицу `migrations` и помечает начальную миграцию применённой, не трогая данные.
- Новые изменения схемы оформляются как отдельные миграции; `synchronize` больше не используется.

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
| POST | `/api/catalog` | створити курс (власник — поточний викладач) |
| PATCH | `/api/catalog/:courseId/owner` | призначити відповідального викладача (admin) |
| POST | `/api/catalog/:courseId/modules` | добавить модуль |
| POST | `/api/catalog/modules/:moduleId/lessons` | добавить материал (текст/ссылка/видео) |
| POST | `/api/catalog/modules/:moduleId/lessons-file` | материал с файлом (`multipart`, до 60 МБ) |
| PATCH | `/api/catalog/lessons/:id` | редактировать материал |
| GET | `/api/catalog/lessons/:id/file` | скачать файл материала |
| POST | `/api/catalog/lessons/:id/toggle` | отметить урок пройденным |
| GET/POST | `/api/assignments-full` | задания со сдачами / создать |
| POST | `/api/assignments/:id/submit` | сдать работу (JSON, без файла) |
| POST | `/api/assignments/:id/submit-file` | сдать работу с файлом (`multipart/form-data`, поле `file`, до 25 МБ) |
| GET | `/api/submissions/:id/file` | скачать файл сдачи (владелец, teacher, admin) |
| GET/POST/DELETE | `/api/enrollments`, `/api/groups/:id/enroll`, `/api/groups/:id/enroll/:userId` | зачисления (admin) |
| PATCH | `/api/groups/:id/curator` | призначити куратора групи (admin) |
| PATCH | `/api/auth/users/:id/status` | статус навчання (admin) |
| GET | `/api/audit/logs?search=&status=&limit=` | журнал безопасности (admin) |
| GET | `/api/audit/stats` | агрегаты аудита (admin) |
| POST | `/audit/events` (internal) | приём событий от gateway по `x-audit-secret` |
| POST | `/api/grading/grade` | оценить (Strategy) |
| GET | `/api/grades` | журнал (студент — только свои) |
| GET/POST | `/api/groups` | группы |
| GET/POST | `/api/webinars` | вебинары |
| PATCH | `/api/webinars/:id/status` | статус эфира |
| PATCH | `/api/webinars/:id/meeting` | посилання на Meet/Zoom (teacher/admin) |
| POST | `/api/webinars/:id/chat` | сообщение в чат |
| GET | `/api/webinars/stream` | SSE-поток: чат, статус эфира, новые вебинары, WebRTC-сигналы |
| POST | `/api/webinars/:id/signal` | WebRTC signaling: `offer`, `answer`, `ice`, `join`, `hand`, `media-start/stop` |
| GET | `/api/config/ice` | ICE-сервери (STUN/TURN) для WebRTC |
| GET | `/api/webinars/:id/attendance` | журнал відвідуваності (teacher/admin) |
| POST/GET | `/api/webinars/:id/recording` | завантажити / скачати запис лекції |
| GET | `/api/enrollments?courseId=` | реальный ростер курса (для участников вебинара) |
| GET | `/api/schedule?groupId=&courseId=` | розклад занять групи/курсу |

| GET | `/api/analytics/overview` | аналітика деканату: борги, пропуски, не перевірено, успішність груп (admin) |
| GET | `/api/auth/directory` | довідник користувачів для вибору отримувача |
| GET/POST | `/api/messages/inbox`, `/api/messages` | вхідні та надсилання повідомлень |
| GET | `/api/messages/sent`, `/api/messages/unread` | надіслані та кількість непрочитаних |
| GET | `/api/messages/thread/:userId` | повний діалог з користувачем |
| PATCH | `/api/messages/:id/read`, `/api/messages/thread/:userId/read` | позначити прочитаним |
| PATCH | `/api/messages/read-all` | позначити всі вхідні прочитаними |
| PATCH | `/api/auth/me` | оновити власний профіль |
| POST | `/api/auth/change-password` | змінити власний пароль |
| PATCH | `/api/auth/users/:id` | редагувати користувача (admin) |
| POST | `/api/auth/users/:id/password` | скинути пароль користувача (admin) |
| GET/POST | `/api/announcements` | оголошення (перегляд / публікація teacher, admin) |
| DELETE | `/api/announcements/:id` | видалити оголошення (автор або admin) |
| POST/DELETE | `/api/schedule`, `/api/schedule/:id` | керування розкладом (teacher/admin) |

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
  communication-service/ сообщения между ролями            :3005
  api-gateway/           шлюз, JWT, CORS, rate-limit        :3000
services/*/src/database/migrations/  начальные миграции схемы (TypeORM)
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

- **Real-time**: SSE и signaling работают в одном инстансе. Для нескольких инстансов нужен
  Redis Pub/Sub адаптер. WebRTC использует публичный STUN; для строгого NAT нужен собственный TURN.
- **WebRTC**: реализовано вещание «преподаватель → студенты» (камера/экран). Студенты пока не
  отправляют видео, а «поднятая рука» приходит преподавателю сигналом (без видео-запроса).
  Для строгого NAT используйте `coturn` из compose и задайте `TURN_URL` в `.env`.
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
