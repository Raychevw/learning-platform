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

### 3.9. Здача лабораторної: повний ланцюжок

**Frontend** — `src/App.jsx`, рядок **994**, `handleStudentSubmit`:

```js
const formData = new FormData();
formData.append('file', file);
if (comment) formData.append('comment', comment);
res = await syncBackend(`/assignments/${targetAsg.id}/submit-file`, 'POST', formData);
```

Далі запит іде через шлюз у `assignment-service`.

**Controller** — `services/assignment-service/src/coursework/coursework.controller.ts`,
рядок **68**, `POST /assignments/:id/submit-file`:

- `FileInterceptor` приймає файл;
- `@Roles(UserRole.STUDENT)` — здавати може лише студент;
- особа студента береться з JWT (`req.user`), а не з тіла запиту.

**Service** — `services/assignment-service/src/coursework/coursework.service.ts`,
рядок **189**, `persistSubmission`:

1. знаходить завдання в БД (`this.assignments.findOneBy`);
2. рахує прострочення: `now > dueDate` → `isLate = true` (рядок **200**);
3. перевіряє, чи завдання вже відкрите (`openAt`);
4. перевіряє розширення файлу за `allowedFormats` (рядки **211–217**);
5. якщо пізня здача заборонена — повертає `400`;
6. визначає групу студента із зарахування (`resolveGroupName`, рядок **226**);
7. зберігає файл через адаптер сховища (`this.storage.put`, рядок **237**) —
   локальний диск або S3/MinIO;
8. створює або оновлює рядок у таблиці `submissions`:
   `status = 'READY_FOR_GRADING'`, `score = null`, `isLate`, `fileKey` (рядки **244–265**);
9. якщо файл замінено — видаляє старий артефакт (рядки **273–275**).

**Таблиця `submissions`:**

- один рядок на пару `(assignmentId, studentId)` — це гарантує unique-індекс;
- зберігає `studentName`, `group_name`, `submittedAt`, `fileName`, `fileKey`,
  `isLate`, `status`, `score`.

**Скачування файлу** — `coursework.service.ts`, рядок **280**:
студент може скачати лише свій файл, викладач/деканат — будь-який у межах доступу.

Що показати:

1. Студент обирає PDF/DOCX і натискає «Здати роботу».
2. У консолі БД:
   ```powershell
   & $psql -h localhost -p 5432 -U postgres -d assignment_db `
     -c 'SELECT id, status, score FROM submissions ORDER BY id DESC LIMIT 3;'
   ```
3. У новому рядку — `READY_FOR_GRADING`, `score` порожній.

### 3.10. Оцінювання: рубрика, Strategy і транзакція

**Frontend** — `src/App.jsx`, рядок **1113**, `handleGradeWithStrategy`:

- бали за критеріями вводяться у формі;
- `liveRawScore` — сума критеріїв (рядок **1092**);
- `liveFinalScore` — попередній розрахунок із урахуванням правила (рядок **1102**);
- після сабміту — `POST /api/grading/grade`.

**Controller** — `coursework.controller.ts`, рядок **110**:

```ts
@Post('grading/grade')
@Roles(UserRole.TEACHER)
```

Деканат цей endpoint викликати не може — отримує `403`. Це перевіряється в
`verify:lab3`.

**Service** — `coursework.service.ts`, рядок **298**, `gradeSubmission`:

1. завантажує здачу та завдання з БД;
2. бере критерії рубрики;
3. викликає `validateCriteriaScores(...)` — `grading-policy.ts`, рядок **10**:
   - невідомий критерій → `400`;
   - від'ємний бал → `400`;
   - бал більший за максимум критерію → `400`;
   - сума більша за максимум роботи → `400`;
4. визначає правило через `resolveRule(...)` — рядок **41**:
   - `AUTO` + прострочення → `LATE_PENALTY`;
   - інакше `STANDARD`; викладач може явно вибрати `EXCELLENCE_BONUS`;
5. передає дані в доменний use case, який застосовує **Strategy**:
   - `LatePenaltyGradingStrategy` — мінус 20% за пізню здачу;
   - `ExcellenceBonusGradingStrategy` — +5 балів, якщо ≥ 90% і вчасно;
   - `StandardGradingStrategy` — без змін;
6. у транзакції (рядок **333**):
   - оновлює `submissions`: `status = 'GRADED'`, `score = finalScore`;
   - створює або оновлює рядок у `grades`;
7. повертає фінальний бал, правило та ECTS.

Що показати:

1. Викладач відкриває «Оцінювання», вибирає роботу.
2. Вводить бали за критеріями — підсумок і ECTS оновлюються одразу.
3. Натискає «Виставити оцінки».
4. У консолі БД:
   ```powershell
   & $psql -h localhost -p 5432 -U postgres -d assignment_db `
     -c 'SELECT id, status, score FROM submissions WHERE id = ''sub-2'';'
   & $psql -h localhost -p 5432 -U postgres -d assignment_db `
     -c 'SELECT * FROM grades LIMIT 2;'
   ```
5. У `submissions` статус став `GRADED`, з'явився бал; у `grades` — новий рядок.

### 3.11. Що сказати про бізнес-правила

- Одна робота на студента й завдання — unique-індекс у БД.
- Прострочення фіксує сервер, а не браузер.
- Штраф 20% застосовується автоматично, якщо викладач не вибрав інше правило.
- Бали за рубрикою перевіряються на сервері: «намалювати» 999 балів у DevTools
  не вийде.
- Оцінка й здача зберігаються транзакційно — або обидва записи, або жоден.
- Деканат не має права оцінювати — це закрито на рівні RBAC.

---

## 4. Жива демонстрація БД (найефектніше)

### Варіант 1 — готовий скрипт (найпростіше)

У корені проєкту:

```powershell
.\scripts\show-db.ps1
```

Скрипт показує:

1. користувачів, ролі та телефони;
2. дисципліни, модулі, уроки, розклад;
3. здачі лабораторних;
4. журнал оцінок;
5. групи та зарахування;
6. журнал аудиту;
7. кількість повідомлень.

Для демонстрації з паузами:

```powershell
.\scripts\show-db.ps1 -Pause
```

Окремий розділ:

```powershell
.\scripts\show-db.ps1 -Only submissions
.\scripts\show-db.ps1 -Only grades
.\scripts\show-db.ps1 -Only users
.\scripts\show-db.ps1 -Only groups
```

Скрипт лише читає дані — нічого не змінює.

### Варіант 2 — psql із правильним UTF-8

Якщо у звичайному PowerShell українські літери виглядають як «кракозябри»,
використовуйте готовий запуск:

```powershell
# інтерактивна сесія psql
.\scripts\db-console.ps1 -Database assignment_db

# або один запит
.\scripts\db-console.ps1 -Database auth_db `
  -Query "SELECT full_name, phone, role FROM users ORDER BY role, full_name;"
```

Скрипт сам перемикає консоль на UTF-8, бере пароль із `.env` і запускає psql.

Для ручного запуску спочатку виконайте:

```powershell
chcp 65001
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$env:PGCLIENTENCODING = 'UTF8'
$env:PGPASSWORD = 'postgres'
$psql = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
```

І вже потім:

```powershell
& $psql -h localhost -p 5432 -U postgres -d assignment_db -c '\dt'
```

### Сценарій A: подивитися здачі до/після дії

```powershell
& $psql -h localhost -p 5432 -U postgres -d assignment_db `
  -c 'SELECT id, status, score FROM submissions ORDER BY id;'
```

Показати в UI сторінку «Оцінювання», виставити оцінку, повторити запит —
у рядка з'явиться `GRADED` і бал.

### Сценарій A2: оцінювання sub-2 крок за кроком

Підготовлені SQL-файли (нічого не треба вводити вручну):

```powershell
# 1. Стан ДО: sub-2 у черзі, оцінки ще немає
& $psql -h localhost -p 5432 -U postgres -d assignment_db `
  -f .\scripts\sql\demo-grading-before.sql
```

Далі в UI:

1. Увійти як `teacher` / `123456`.
2. Відкрити «Оцінювання».
3. Вибрати **Марина Шевченко (ІПЗ-412) — Лабораторна робота 3**.
4. Ввести бали за критеріями.
5. Вибрати правило `EXCELLENCE_BONUS` (щоб було видно бонус +5).
6. Натиснути «Виставити оцінки».

Після цього:

```powershell
# 2. Стан ПІСЛЯ: GRADED + новий рядок у grades
& $psql -h localhost -p 5432 -U postgres -d assignment_db `
  -f .\scripts\sql\demo-grading-after.sql
```

Очікувано:

- `sub-2`: `status = GRADED`, `score = 96.00`;
- у `grades`: новий рядок із `rule = EXCELLENCE_BONUS` і критеріями.

Повернути роботу в чергу після демонстрації:

```powershell
& $psql -h localhost -p 5432 -U postgres -d assignment_db `
  -f .\scripts\sql\demo-grading-reset.sql
```

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
