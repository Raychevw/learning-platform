# Studevo — runbook для захисту

Особистий план: як запустити проєкт, що показати на фронтенді та які файли
відкрити в коді, щоб пояснити зв'язок **frontend → gateway → service → PostgreSQL**.

---

## 1. Запуск (2 хвилини)

```powershell
cd C:\Users\lenovo\.antigravity-ide\extensions\learning-platform

# якщо стек уже запущений — спочатку зупинити
.\stop-all.ps1

# запуск без автоматичного відкриття браузера
.\start-all.ps1 -NoBrowser
```

Дочекатися рядків:

```text
auth - UP
course - UP
assignment - UP
audit - UP
communication - UP
gateway - UP
frontend - PID ..., порт 5173
```

Перевірка:

```powershell
Invoke-RestMethod http://localhost:3000/health
# status = UP
```

Відкрити **http://localhost:5173**.

### Якщо щось не піднялося

```powershell
.\stop-all.ps1
Get-Content logs\auth.err.log -Tail 30
Get-Content logs\gateway.err.log -Tail 30
.\start-all.ps1 -NoBrowser
```

База даних PostgreSQL має бути запущена як служба Windows (порт 5432).

---

## 2. Фронтенд: що показувати (5–7 хвилин)

### Деканат — `admin` / `123456`

1. **Панель** — 8 студентів, 4 групи, 5 робіт на перевірці, успішність груп.
2. **Студенти** — окремий довідник:
   - пошук за прізвищем;
   - фільтр за групою;
   - мобільні номери `+380 …` (клікабельні);
   - пагінація по 20 (на 8 записах кнопки приховані).
3. **Дисципліни** — форма створення дисципліни з вибором викладача.
   Показати, що декан створює курс і одразу закріплює його за викладачем.
4. **Відомості** — банер «Режим перегляду»: деканат не оцінює роботи, лише
   переглядає та експортує CSV.
5. **Журнал** — реальні події входу та змін.

### Викладач — `teacher` / `123456`

1. **Панель** — «5 робіт очікують перевірки», дедлайни, розклад.
2. **Оцінювання**:
   - вибрати роботу студента;
   - показати критерії та бали;
   - підсумковий бал і ECTS;
   - натиснути «Виставити оцінки».
3. **Мої курси → дисципліна** — модулі, матеріали, кнопка «Додати матеріал»,
   зовнішнє посилання на Google Meet/Zoom.
4. **Онлайн-заняття** — заняття відкриваються лише за зовнішнім посиланням.

### Студент — `student` / `123456`

1. **Панель** — курси, дедлайни, середній бал.
2. **Мої курси → дисципліна** — програма, матеріали, прогрес.
3. **Завдання** — вибрати файл PDF/DOCX і здати роботу.
4. **Оцінки** — оцінка, ECTS, коментар викладача.
5. **Мій профіль** — телефон, редагування даних, зміна пароля.

Повний сценарій із таймінгом — у [DEMO.md](DEMO.md).

---

## 3. Код: як frontend звертається до backend

### 3.1. HTTP-клієнт фронтенду

Файл: `src/api/client.js`

- рядок **40** — функція `request(path, options)`;
- рядок **60** — додає заголовок `Authorization: Bearer <token>`;
- рядок **136** — `api.login()` викликає `POST /api/auth/login`.

Усі запити йдуть на відносний `/api`, тому в dev їх проксіює Vite, а в prod — nginx.

### 3.2. Шлюз

Файл: `services/api-gateway/src/main.ts`

- рядок **149** — обмеження спроб входу;
- рядок **168** — `jwt.verify(...)` перевіряє підпис токена;
- рядок **330** — `mountProxy(...)`, рядки **338–346** — таблиця маршрутів:
  `/api/auth` → auth-service, `/api/catalog` → course-service,
  `/api/grading` → assignment-service тощо.

Що сказати: *«Браузер не знає про внутрішні сервіси. Він звертається лише до
шлюзу, а шлюз перевіряє JWT і проксіює запит у потрібний мікросервіс.»*

### 3.3. Сервіс і підключення до БД

Файл: `services/auth-service/src/auth.module.ts`, рядки **18–31**:

```ts
TypeOrmModule.forRootAsync({
  useFactory: (configService: ConfigService) => ({
    type: 'postgres',
    host: configService.get<string>('DB_HOST', 'localhost'),
    port: Number(configService.get<number>('DB_PORT', 5432)),
    username: configService.get<string>('DB_USER', 'postgres'),
    password: configService.get<string>('DB_PASSWORD', 'postgres'),
    database: configService.get<string>('DB_NAME', 'auth_db'),
    entities: [UserEntity],
    migrations: [...],
    migrationsRun: true,
    synchronize: false,
  }),
});
```

Що сказати:

- параметри беруться з `.env`;
- `entities` — це класи, які TypeORM перетворює на таблиці;
- `migrationsRun: true` — при старті застосовуються міграції;
- `synchronize: false` — схема змінюється лише міграціями, щоб не втратити дані.

### 3.4. Сутність таблиці

Файл: `services/auth-service/src/users/user.entity.ts`

```ts
@Entity('users')
export class UserEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ name: 'full_name', type: 'varchar', length: 255 })
  fullName: string;

  @Column({ name: 'phone', type: 'varchar', length: 32, nullable: true })
  phone: string | null;
}
```

Що сказати: *«Клас описує таблицю. TypeORM будує SQL і мапить рядки PostgreSQL
на об'єкти — писати SQL вручну для CRUD не потрібно.»*

### 3.5. Міграція — реальний SQL

Файл: `services/auth-service/src/database/migrations/1730000000000-init.ts`

```sql
CREATE TABLE public.users (
    id character varying(64) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    full_name character varying(255) NOT NULL,
    ...
);
```

Показати також `1730000000002-user-phone.ts` — саме ця міграція додала колонку
`phone`. Це доказ, що схема керується версійно, а не «руками».

### 3.6. Реальна операція: вхід

Файл: `services/auth-service/src/auth/auth.service.ts`, рядки **28–68**

- знаходить користувача через `this.users.findOne(...)`;
- порівнює пароль через `bcrypt.compare(...)`;
- формує JWT і повертає `toPublicUser(user)`.

### 3.7. Транзакція в assignment-service

Файл: `services/assignment-service/src/coursework/coursework.service.ts`,
рядки **333–359**

```ts
const saved = await this.dataSource.transaction(async (em) => {
  sub.status = 'GRADED';
  sub.score = finalScore;
  await em.save(SubmissionEntity, sub);

  let grade = await em.findOneBy(GradeEntity, { submissionId: sub.id });
  ...
  return em.save(GradeEntity, grade);
});
```

Що сказати: *«Оцінювання змінює дві таблиці — `submissions` і `grades`.
Це відбувається в одній транзакції: або зберігається все, або нічого.»*

### 3.8. Database-per-service

У `.env` кожен сервіс має власну `DB_NAME`:

| Сервіс | База |
|---|---|
| auth-service | `auth_db` |
| course-service | `course_db` |
| assignment-service | `assignment_db` |
| audit-service | `audit_db` |
| communication-service | `communication_db` |

У Docker ці бази рознесені на різні контейнери та порти (див. `docker-compose.yml`).
Локально вони живуть на одному PostgreSQL, але як **окремі бази**.

---

## 4. Жива демонстрація БД (найефектніше)

Відкрити друге вікно PowerShell. Підключення:

```powershell
$psql = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
$env:PGPASSWORD = 'postgres'

# список таблиць
& $psql -h localhost -p 5432 -U postgres -d assignment_db -c '\dt'
```

### Сценарій A: подивитися здачі до/після дії

```powershell
& $psql -h localhost -p 5432 -U postgres -d assignment_db `
  -c 'SELECT id, status, score FROM submissions ORDER BY id;'
```

Показати в UI сторінку «Оцінювання», виставити оцінку, повторити запит —
у рядка з'явиться `GRADED` і бал.

### Сценарій B: оцінки

```powershell
& $psql -h localhost -p 5432 -U postgres -d assignment_db `
  -c 'SELECT * FROM grades LIMIT 5;'
```

### Сценарій C: студенти та телефони

```powershell
& $psql -h localhost -p 5432 -U postgres -d auth_db `
  -c 'SELECT full_name, phone, role FROM users ORDER BY role, full_name;'
```

Створити студента в UI (або відредагувати телефон) — повторити запит.

### Сценарій D: аудит

```powershell
& $psql -h localhost -p 5432 -U postgres -d audit_db -c '\dt'
& $psql -h localhost -p 5432 -U postgres -d audit_db `
  -c 'SELECT action, user_name, status, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 5;'
```

Після входу в UI з'явиться новий запис.

---

## 5. Що показати в DevTools (30 секунд)

1. F12 → **Network**.
2. Увійти ще раз.
3. Відкрити запит `login` → **Response**: `accessToken`.
4. Відкрити будь-який наступний запит → **Request Headers**:
   `Authorization: Bearer …`.
5. Вкладка **Console** — без помилок.

---

## 6. Питання, які можуть поставити

| Питання | Відповідь |
|---|---|
| Чому мікросервіси? | Розділення відповідальності, окремі БД, незалежне масштабування та деплой |
| Де перевіряється JWT? | І на шлюзі, і в кожному сервісі (defense in depth) |
| Чому `synchronize: false`? | Щоб випадково не змінити схему; усі зміни — через міграції |
| Як пов'язані сервіси? | HTTP через шлюз + Redis Pub/Sub для подій |
| Де зберігаються файли? | S3/MinIO або локальний диск (`STORAGE_DRIVER`) |
| Як деканат не може оцінювати? | RBAC у guard + `403` на `POST /api/grading/grade`; перевіряється в `verify:lab3` |
| Як оновлюється журнал? | Gateway надсилає події в audit-service |

---

## 7. Фінальна перевірка перед показом

```powershell
npm run lint
npm test
npm run verify:lab3
```

Очікувано: lint без помилок, **87/87** тестів, **44/44** перевірки.

Після `verify:lab3` у базі з'являється тестове повідомлення — його можна видалити:

```powershell
& $psql -h localhost -p 5432 -U postgres -d communication_db -c "DELETE FROM messages;"
```

---

## 8. Якщо треба швидко зупинити

```powershell
.\stop-all.ps1
```
