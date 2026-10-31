# Studevo — університетська LMS

Платформа дистанційного навчання: каталог дисциплін і уроків, завдання з рубриками,
здача робіт файлами, журнал оцінок (ECTS A–FX), онлайн-заняття за зовнішніми
посиланнями, академічні групи, повідомлення та журнал аудиту.

Проєкт побудований як **мікросервісна система** з єдиною точкою входу та справжньою
JWT-автентифікацією.

---

## Архітектура

```text
                        ┌──────────────────────────────────┐
   React SPA  ────────▶ │  api-gateway :3000               │
   (Vite / nginx)       │  CORS, перевірка JWT, rate-limit │
                        │  проксіювання запитів            │
                        └───────┬──────────┬───────────────┘
                                │          │
                 ┌──────────────▼──┐   ┌───▼──────────────────┐
                 │ auth-service    │   │ course-service :3001 │
                 │ :3003           │   │ каталог, уроки,      │
                 │ вхід, JWT, RBAC │   │ вебінари             │
                 └───────┬─────────┘   └───┬──────────┬───────┘
                         │                 │          │
                 ┌───────▼──────┐   ┌──────▼──────┐   │
                 │ auth-db      │   │ course-db   │   │
                 └──────────────┘   └─────────────┘   │
                                                     │
                 ┌──────────────────┐   ┌────────────▼─────┐
                 │ assignment-svc   │   │ redis_broker     │
                 │ :3002 завдання,  │◀──┤ події            │
                 │ здачі, оцінки,   │   │ course.published │
                 │ групи            │   └──────────────────┘
                 └───────┬──────────┘   ┌──────────────────┐
                         │              │ minio (S3)       │
                 ┌───────▼──────┐       └──────────────────┘
                 │ assignment-db│
                 └──────────────┘
```

**Принципи:**

- **Database-per-service** — кожен сервіс має власну PostgreSQL (`course_db`,
  `assignment_db`, `auth_db`, `audit_db`, `communication_db`).
- **Єдина точка входу** — браузер звертається лише до шлюзу; внутрішні сервіси
  не публікуються назовні.
- **Defense in depth** — JWT перевіряється і на шлюзі, і в кожному сервісі
  (спільний `JWT_SECRET`).
- **Clean Architecture** — `domain` (сутності, стратегії, інтерфейси) →
  `application` (use cases) → `infrastructure` (TypeORM, Redis, S3, HTTP-клієнти) →
  `presentation` (контролери).
- **Патерни GoF** — Strategy (розрахунок оцінки), Builder (`AssignmentBuilder`),
  Decorator (`Caching/LoggingCourseServiceDecorator`), Repository, DI.
- **Подієва інтеграція** — публікація дисципліни (`course.published`) через Redis
  Pub/Sub та ідемпотентний споживач подій.
- **Graceful degradation** — синхронний виклик Course Service із Assignment Service
  має таймаут 2 с і резервну логіку.
- **Реальні файли** — здачі та матеріали зберігаються у S3/MinIO або на диску
  (`STORAGE_DRIVER`); завантаження доступне лише власнику, викладачу або деканату.
- **Дедлайни та рубрики** — сервер фіксує прострочення, автоматично застосовує
  штраф 20% і перевіряє кожен бал за критеріями.
- **Зарахування** — зв'язок `user ↔ group` у БД визначає групу студента у здачі
  (без хардкоду).
- **Серверний аудит** — окремий `audit-service` пише входи, зміни даних і відмови
  в доступі; деканат бачить реальний журнал і статистику.
- **Realtime** — чат і статус вебінару надходять через SSE (`/api/webinars/stream`),
  тому оновлення видно між пристроями, а не лише між вкладками.
- **Онлайн-заняття через зовнішні конференції** — для кожного вебінару викладач
  додає посилання на Google Meet / Zoom / Teams; студент відкриває його кнопкою
  «Приєднатися».
- **Вбудовану WebRTC-кімнату прибрано** з інтерфейсу; заняття відкриваються лише
  за зовнішнім посиланням. Відповідні legacy-ендпоінти залишені, але фронтенд їх
  не використовує.
- **Здача робіт файлом** — студент завантажує PDF/DOCX (або інший дозволений
  формат), викладач бачить файл, оцінює за рубрикою та залишає відгук; формат
  перевіряється на сервері.
- **Лише реальні учасники** — список студентів і вебінару будується з користувачів
  та зарахувань (`GET /api/enrollments?courseId=`), без вигаданих людей і лічильників.
- **Особистий кабінет студента** — профіль, розклад, дисципліни, завдання зі
  статусами, оцінки/борги та онлайн-заняття з реальних даних.
- **Кабінет викладача** — дисципліни, кількість студентів, найближчі пари, роботи
  на перевірку, статистика успішності; матеріали з файлами (PDF/Word/PPT/відео),
  посиланнями та відео; завдання з датою відкриття, дедлайном і дозволеними
  форматами відповіді.
- **Кабінет деканату** — аналітика успішності (борги, пропущені роботи, роботи на
  перевірці, середній бал по групах), керування користувачами, створення акаунтів,
  переведення між групами, перегляд відомостей та експорт CSV.
- **Деканат не оцінює роботи студентів** — це роблять лише викладачі; сервер
  повертає `403` на `POST /api/grading/grade`.
- **Довідник студентів** — окрема сторінка деканату: пошук за ПІБ/email/телефоном/
  логіном, фільтр за групою, пагінація по 20 записів і клікабельні мобільні номери
  (`tel:`).
- **Дисципліни факультету** — декан створює дисципліну та одразу призначає
  відповідального викладача; викладач наповнює модулі й публікує курс.
- **Власність дисциплін** — викладач бачить і редагує лише свої дисципліни; декан
  призначає відповідального викладача (`PATCH /api/catalog/:courseId/owner`).
- **Повідомлення** — окремий `communication-service`: діалоги студент ↔ викладач ↔
  деканат, непрочитані, позначка «прочитано», відповідь у потоці, довідник
  користувачів.
- **Мій профіль** — кожен користувач редагує ПІБ, email, логін, підрозділ і мобільний
  номер та змінює пароль (`PATCH /api/auth/me`, `POST /api/auth/change-password`).
- **Керування користувачами** — деканат створює акаунти, редагує дані, телефон, роль
  і статус навчання та скидає пароль (`PATCH /api/auth/users/:id`,
  `POST /api/auth/users/:id/password`).
- **Оголошення** — деканат/викладач публікує для всіх, студентів, викладачів або
  окремої групи; показуються на панелі та окремій сторінці.
- **Керування розкладом** — викладач/декан додає та видаляє пари (день, час,
  аудиторія, тип, посилання на онлайн) з окремої сторінки.
- **Куратори та статус навчання** — декан призначає куратора групи та змінює статус
  студента (навчається / відрахований / академвідпустка); неактивні акаунти не
  можуть увійти.
- **Адаптивний інтерфейс** — на телефоні сайдбар згортається в компактне меню,
  таблиці скроляться горизонтально, а багатоколонкові форми стають одноколонковими.
- **Надійність UI** — error boundary замість «білого екрана», глобальний індикатор
  запису та блокування повторної відправки форм.
- **Міграції** — схема керується TypeORM-міграціями (`synchronize: false`,
  `migrationsRun: true`); нові БД створюються автоматично, наявні переводяться через
  `npm run db:baseline`.

---

## Швидкий старт

### Варіант A — Docker (увесь стек однією командою)

```bash
cp .env.example .env      # Windows: copy .env.example .env
docker compose up --build
```

| Що | Адреса |
|---|---|
| Застосунок | http://localhost:8080 |
| API Gateway | http://localhost:3000/health |
| Swagger (course) | http://localhost:3001/api/docs |
| Swagger (assignment) | http://localhost:3002/api/docs |
| Swagger (auth) | http://localhost:3003/api/docs |
| Swagger (audit) | http://localhost:3004/api/docs |
| Swagger (messages) | http://localhost:3005/api/docs |
| MinIO console | http://localhost:9001 |

Зупинка: `docker compose down` (дані залишаються у volumes),
`docker compose down -v` — видалити дані.

### Варіант B — локально (Windows / PowerShell)

```powershell
.\start-all.ps1
# опції: -SkipBuild, -Infra local, -NoBrowser
```

Скрипт:
1. читає `.env` (створює з `.env.example`, якщо файлу немає);
2. піднімає інфраструктуру (`-Infra auto` → docker compose, інакше локальний PostgreSQL);
3. збирає сервіси (`npm run build:services`);
4. запускає auth/course/assignment/audit/communication/gateway, чекає `/health`,
   пише логи в `logs/`;
5. запускає Vite і відкриває http://localhost:5173.

Зупинка: `.\stop-all.ps1` (або `.\stop-all.ps1 -Docker`, щоб зупинити й контейнери).

### Міграції та наявні БД

Схема сервісів керується TypeORM-міграціями: `synchronize: false`,
`migrationsRun: true`. Початкова міграція (`Init1730000000000`) лежить у
`services/*/src/database/migrations/`.

- **Нова/порожня БД** — схема створиться автоматично під час першого старту сервісу.
- **БД із попередньої версії проєкту** (таблиці вже є) — один раз виконайте:

  ```bash
  npm run db:baseline           # локальний PostgreSQL
  npm run db:baseline:docker    # контейнери compose (порти 5433–5436)
  ```

  Скрипт створює таблицю `migrations` і позначає початкову міграцію застосованою,
  не змінюючи дані.
- Нові зміни схеми оформлюються окремими міграціями; `synchronize` не використовується.

### Вимоги

- Node.js **22+**, npm 10+
- Docker Desktop (для варіанту A / `-Infra docker`) або локальні PostgreSQL 15+ і
  Redis 7+
- Для локального режиму створіть БД: `course_db`, `assignment_db`, `auth_db`,
  `audit_db`, `communication_db` (скрипт спробує зробити це через `psql`, якщо він
  є в `PATH`).

---

## Демо-доступ

Акаунти створюються `auth-service` під час старту (паролі зберігаються як bcrypt-хеші):

| Роль | Логіни | Email (основний) | Пароль |
|---|---|---|---|
| Студенти | `student`, `student2` … `student8` | o.petrenko@univ.edu.ua | `123456` |
| Викладачі | `teacher`, `teacher2`, `teacher3` | d.kovalenko@univ.edu.ua | `123456` |
| Деканат | `admin` | dekanat.fiot@univ.edu.ua | `123456` |

Демо-склад: 8 студентів у групах ІПЗ-412, ІПЗ-411, КН-301; 3 викладачі
(Дмитро Коваленко, Олена Грищенко, Василь Мельник); 5 робіт на перевірку та
5 перевірених робіт з оцінками. Пароль задається `DEMO_PASSWORD` у `.env`.
У production — `SEED_DEMO_DATA=false`.

> Покроковий сценарій демонстрації на 5–7 хвилин — у [docs/DEMO.md](docs/DEMO.md).
> Runbook для захисту (запуск, показ коду, зв'язок з БД) — у
> [docs/PRESENTATION.md](docs/PRESENTATION.md).

---

## Автентифікація та права

```http
POST /api/auth/login
{ "login": "teacher", "password": "123456" }

200 OK
{ "accessToken": "<jwt>", "tokenType": "Bearer", "expiresIn": "8h", "user": { ... } }
```

Далі всі запити: `Authorization: Bearer <jwt>`.

- JWT підписується `JWT_SECRET` (HS256), термін дії — `JWT_EXPIRES_IN`
  (за замовчуванням 8h).
- Gateway **видаляє** будь-які клієнтські заголовки `x-user-*` і підставляє їх із
  перевіреного токена.
- Gateway обмежує вхід (20 спроб / 5 хвилин на IP) і CORS (`CORS_ORIGINS`).
- RBAC:

| Дія | Ролі |
|---|---|
| Перегляд каталогу, завдань, вебінарів | усі автентифіковані |
| Робота з власними здачами/оцінками | студент бачить лише свої (фільтрація на сервері) |
| Створення/публікація дисциплін, модулів, уроків, вебінарів | teacher, admin |
| Створення завдань | teacher, admin |
| Оцінювання робіт | лише teacher; admin (деканат) отримує 403 |
| Здача роботи | student (особа береться з токена) |
| Групи, користувачі, телефони | admin |
| Перегляд відомостей та експорт CSV | admin (лише читання) |

---

## API (стисло)

| Метод | Шлях | Призначення |
|---|---|---|
| POST | `/api/auth/login` | вхід, видача JWT (public) |
| GET | `/api/auth/me` | профіль за токеном |
| PATCH | `/api/auth/me` | оновити власний профіль (у т. ч. телефон) |
| POST | `/api/auth/change-password` | змінити власний пароль |
| GET/POST | `/api/auth/users` | список/створення користувачів (admin) |
| PATCH | `/api/auth/users/:id` | редагувати користувача, телефон (admin) |
| POST | `/api/auth/users/:id/password` | скинути пароль користувача (admin) |
| PATCH | `/api/auth/users/:id/status` | статус навчання (admin) |
| GET | `/api/auth/directory` | довідник користувачів для вибору отримувача |
| GET | `/api/catalog?userId=` | каталог із модулями, уроками, прогресом |
| POST | `/api/catalog` | створити дисципліну (викладач або деканат) |
| PATCH | `/api/catalog/:courseId/owner` | призначити відповідального викладача (admin) |
| POST | `/api/catalog/:courseId/modules` | додати модуль |
| POST | `/api/catalog/modules/:moduleId/lessons` | додати матеріал (текст/посилання/відео) |
| POST | `/api/catalog/modules/:moduleId/lessons-file` | матеріал із файлом (`multipart`, до 60 МБ) |
| PATCH | `/api/catalog/lessons/:id` | редагувати матеріал |
| GET | `/api/catalog/lessons/:id/file` | завантажити файл матеріалу |
| POST | `/api/catalog/lessons/:id/toggle` | позначити урок пройденим |
| GET/POST | `/api/assignments-full` | завдання зі здачами / створити |
| POST | `/api/assignments/:id/submit` | здати роботу (JSON, без файлу) |
| POST | `/api/assignments/:id/submit-file` | здати роботу з файлом (`multipart/form-data`, поле `file`, до 25 МБ) |
| GET | `/api/submissions/:id/file` | завантажити файл здачі (власник, teacher, admin) |
| POST | `/api/grading/grade` | оцінити роботу (Strategy; лише teacher) |
| GET | `/api/grades` | журнал оцінок (студент — лише свої) |
| GET/POST | `/api/groups` | академічні групи |
| GET/POST/DELETE | `/api/enrollments`, `/api/groups/:id/enroll`, `/api/groups/:id/enroll/:userId` | зарахування (admin) |
| PATCH | `/api/groups/:id/curator` | призначити куратора групи (admin) |
| GET | `/api/enrollments?courseId=` | реальний список студентів дисципліни |
| GET | `/api/analytics/overview` | аналітика деканату: борги, пропуски, на перевірці, успішність груп (admin) |
| GET/POST | `/api/webinars` | вебінари |
| PATCH | `/api/webinars/:id/status` | статус ефіру |
| PATCH | `/api/webinars/:id/meeting` | посилання на Meet/Zoom (teacher/admin) |
| POST | `/api/webinars/:id/chat` | повідомлення в чат |
| GET | `/api/webinars/stream` | SSE-потік: чат, статус ефіру, нові вебінари |
| POST | `/api/webinars/:id/signal` | legacy WebRTC signaling (UI не використовує) |
| GET | `/api/config/ice` | legacy ICE-конфігурація (UI не використовує) |
| GET | `/api/webinars/:id/attendance` | журнал відвідуваності (teacher/admin) |
| POST/GET | `/api/webinars/:id/recording` | завантажити / отримати запис лекції |
| GET | `/api/schedule?groupId=&courseId=` | розклад занять групи/дисципліни |
| POST/DELETE | `/api/schedule`, `/api/schedule/:id` | керування розкладом (teacher/admin) |
| GET | `/api/audit/logs?search=&status=&limit=` | журнал безпеки (admin) |
| GET | `/api/audit/stats` | агрегати аудиту (admin) |
| POST | `/audit/events` (internal) | приймання подій від gateway за `x-audit-secret` |
| GET/POST | `/api/messages/inbox`, `/api/messages` | вхідні та надсилання повідомлень |
| GET | `/api/messages/sent`, `/api/messages/unread` | надіслані та кількість непрочитаних |
| GET | `/api/messages/thread/:userId` | повний діалог із користувачем |
| PATCH | `/api/messages/:id/read`, `/api/messages/thread/:userId/read` | позначити прочитаним |
| PATCH | `/api/messages/read-all` | позначити всі вхідні прочитаними |
| GET/POST | `/api/announcements` | оголошення (перегляд / публікація teacher, admin) |
| DELETE | `/api/announcements/:id` | видалити оголошення (автор або admin) |

Повні специфікації: `contracts/*.json` (генеруються зі Swagger) і
`contracts/events-schema.json`.

---

## Перевірки та тести

```bash
npm run lint            # ESLint (фронтенд + скрипти)
npm run test            # Vitest: домен, стратегії, декоратори, ідемпотентність
npm run build:all       # збірка сервісів + SPA
npm run verify:lab3     # архітектурна верифікація (контракти, compose, fallback, події)
```

`verify:lab3` перевіряє: наявність контрактів, database-per-service і брокер у
compose, зібрані артефакти, спрацювання fallback за недоступного Course Service,
ідемпотентність обробки `course.published`, а за запущеного стеку — живий `/health`,
`/api/catalog`, аудит, повідомлення, аналітику та заборону оцінювання для деканату
(`403`). Усього 44 перевірки.

Юніт-тести: 87 (18 файлів) — домен, стратегії оцінювання, декоратори, RBAC,
ідемпотентність.

---

## Структура репозиторію

```text
src/                     React SPA
  api/client.js          HTTP-клієнт: /api, Bearer, ApiError, подія 401
  auth/useAuth.js        JWT-сесія, профіль, автовихід
  data/seed.js           offline-демо-дані (fallback, не джерело істини)
  lib/id.js              генерація ідентифікаторів
  components/            ErrorBoundary та спільні UI-компоненти
  App.jsx                UI та стан платформи
services/
  auth-service/          вхід, bcrypt, JWT, RBAC              :3003
  course-service/        каталог, уроки, вебінари, S3          :3001
  assignment-service/    завдання, здачі, оцінки, групи        :3002
  audit-service/         журнал безпеки та статистика          :3004
  communication-service/ повідомлення між ролями               :3005
  api-gateway/           шлюз, JWT, CORS, rate-limit            :3000
services/*/src/database/migrations/  міграції схеми (TypeORM)
contracts/               OpenAPI + JSON-схеми подій
scripts/verify-lab3.js   архітектурна верифікація
infra/frontend/          Dockerfile + nginx для SPA
archive/backend-monolith попередній модульний моноліт (не використовується)
docs/                    сценарій демонстрації та скріншоти
```

> `archive/backend-monolith` — попередня реалізація «усе в одному NestJS-застосунку».
> Залишена для історії та порівняння підходів; у збірці й запуску не бере участі.

---

## Конфігурація

Усі змінні — у `.env` (шаблон: `.env.example`). Ключові:

| Змінна | Призначення | За замовчуванням |
|---|---|---|
| `JWT_SECRET` | підпис JWT (змінити в prod!) | dev-значення |
| `JWT_EXPIRES_IN` | термін дії токена | `8h` |
| `CORS_ORIGINS` | дозволені origin через кому | `localhost:5173,localhost:8080` |
| `DB_USER` / `DB_PASSWORD` | доступ до PostgreSQL | `lms` / `lms_secure_password` |
| `SEED_DEMO_DATA` | створювати демо-дані | `true` |
| `DEMO_PASSWORD` | пароль демо-акаунтів | `123456` |
| `REDIS_HOST` / `REDIS_PORT` | брокер подій | `localhost:6379` |
| `STORAGE_DRIVER` | `local` (диск) або `s3` (MinIO) | `local` |
| `STORAGE_LOCAL_DIR` | каталог локального сховища | `./storage/uploads` |
| `ALLOW_LATE_SUBMISSION` | приймати роботи після дедлайну | `true` |
| `AUDIT_INGEST_TOKEN` | внутрішній токен gateway → audit-service | = `JWT_SECRET` |
| `AUDIT_SERVICE_URL` | адреса audit-service | `http://localhost:3004` |
| `S3_*` | MinIO / S3 | `localhost:9000`, bucket `lms-files` |

`VITE_API_BASE` зазвичай порожній: фронтенд звертається до відносного `/api`
(Vite proxy у dev, nginx у prod).

---

## Поточні обмеження

- **Онлайн-заняття**: відеозв'язок відбувається у зовнішніх сервісах
  (Google Meet / Zoom / Teams). Studevo зберігає посилання, статус ефіру та
  відвідуваність; вбудованого відео немає.
- **Real-time**: SSE працює в межах одного інстансу. Для кількох інстансів потрібен
  Redis Pub/Sub адаптер (Redis уже підключений для подій дисциплін).
- **Завантаження файлів** працює і для здач робіт, і для матеріалів уроків
  (PDF, Word, PPT, ZIP, відео; до 60 МБ на файл).
- **Фронтенд**: `App.jsx` залишається великим файлом (без роутера та feature-розбиття).

---

## Усунення неполадок

| Симптом | Причина / рішення |
|---|---|
| «Не вдалося з’єднатися з сервером» | gateway не запущений; перевірте `logs/gateway.err.log`, `http://localhost:3000/health` |
| 401 після входу | минув термін токена або різний `JWT_SECRET` у gateway і сервісів |
| Сервіс не стартує | немає БД/Redis: `docker compose up -d course-db assignment-db auth-db redis_broker` |
| Порт зайнятий | `.\stop-all.ps1` або `docker compose down` |
| Порожній каталог | `SEED_DEMO_DATA=false` або БД не створена; перевірте логи course-service |
| Помилка CORS | додайте origin у `CORS_ORIGINS` і перезапустіть gateway |
| Немає поля `phone` у БД | застосуйте міграції: перезапустіть auth-service (`migrationsRun: true`) |

Логи локального запуску: `logs/<service>.out.log` і `logs/<service>.err.log`.
Логи Docker: `docker compose logs -f <service>`.
