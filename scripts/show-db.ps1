# Studevo — показ бази даних для демонстрації.
# Скрипт лише читає дані (SELECT), нічого не змінює.
#
# Приклади:
#   .\scripts\show-db.ps1
#   .\scripts\show-db.ps1 -Pause
#   .\scripts\show-db.ps1 -Only users
#
# Параметри:
#   -Pause       пауза між розділами (зручно для захисту)
#   -Only NAME   показати лише один розділ: users | courses | submissions | grades | groups | audit | messages

param(
    [switch]$Pause,
    [ValidateSet('users', 'courses', 'submissions', 'grades', 'groups', 'audit', 'messages', 'all')]
    [string]$Only = 'all'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

# UTF-8, щоб українські імена в таблицях не перетворювалися на «кракозябри».
try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $env:PGCLIENTENCODING = 'UTF8'
} catch { }

# Пароль беремо з .env, щоб не тримати його в команді.
$dbPassword = 'postgres'
$envFile = Join-Path $root '.env'
if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile) {
        if ($line -match '^\s*DB_PASSWORD\s*=\s*(.+)\s*$') {
            $dbPassword = $matches[1].Trim().Trim('"').Trim("'")
        }
    }
}
$env:PGPASSWORD = $dbPassword

$psql = (Get-Command psql -ErrorAction SilentlyContinue).Source
if (-not $psql) {
    $candidate = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending |
        Select-Object -First 1
    if ($candidate) { $psql = $candidate.FullName }
}
if (-not $psql) {
    Write-Host 'Не знайдено psql.exe. Додайте C:\Program Files\PostgreSQL\17\bin у PATH.' -ForegroundColor Red
    exit 1
}

function Write-Title([string]$text) {
    Write-Host ''
    Write-Host ('=' * 78) -ForegroundColor DarkGray
    Write-Host "  $text" -ForegroundColor Yellow
    Write-Host ('=' * 78) -ForegroundColor DarkGray
}

function Write-Note([string]$text) {
    Write-Host "  $text" -ForegroundColor DarkGray
}

function Show-Query([string]$db, [string]$sql) {
    & $psql -h localhost -p 5432 -U postgres -d $db -P pager=off -c $sql
}

function Wait-Next {
    if ($Pause) {
        Write-Host ''
        Read-Host 'Enter — наступний розділ' | Out-Null
    }
}

Write-Host ''
Write-Host '  STUDEVO — демонстрація бази даних' -ForegroundColor Red
Write-Host '  Дані лише читаються, зміни не вносяться.' -ForegroundColor DarkGray

if ($Only -in @('all', 'users')) {
    Write-Title '1. Користувачі: ролі та телефони  (auth_db)'
    Write-Note 'Таблиця users. Паролі зберігаються як bcrypt-хеші, не у відкритому вигляді.'
    Show-Query 'auth_db' 'SELECT role, count(*) AS users FROM users GROUP BY role ORDER BY role;'
    Show-Query 'auth_db' 'SELECT full_name, phone, role, status FROM users ORDER BY role, full_name;'
    Wait-Next
}

if ($Only -in @('all', 'courses')) {
    Write-Title '2. Дисципліни, модулі та уроки  (course_db)'
    Write-Note 'Кожна дисципліна має власника-викладача (owner_id).'
    Show-Query 'course_db' 'SELECT * FROM courses ORDER BY id;'
    Show-Query 'course_db' 'SELECT (SELECT count(*) FROM courses) AS courses, (SELECT count(*) FROM course_modules) AS modules, (SELECT count(*) FROM lessons) AS lessons;'
    Show-Query 'course_db' 'SELECT * FROM schedule_entries ORDER BY weekday, id;'
    Wait-Next
}

if ($Only -in @('all', 'submissions')) {
    Write-Title '3. Здачі лабораторних  (assignment_db)'
    Write-Note 'Один рядок на пару «студент + завдання». READY_FOR_GRADING — чекає перевірки.'
    Show-Query 'assignment_db' 'SELECT status, count(*) AS works FROM submissions GROUP BY status ORDER BY status;'
    Show-Query 'assignment_db' 'SELECT * FROM submissions ORDER BY id;'
    Wait-Next
}

if ($Only -in @('all', 'grades')) {
    Write-Title '4. Журнал оцінок  (assignment_db)'
    Write-Note 'Оцінка зберігає критерії, правило розрахунку та коментар викладача.'
    Show-Query 'assignment_db' 'SELECT * FROM grades;'
    Wait-Next
}

if ($Only -in @('all', 'groups')) {
    Write-Title '5. Академічні групи та зарахування  (assignment_db)'
    # Куратор живе в auth_db, тому показуємо його id окремо (без міжбазового JOIN).
    Show-Query 'assignment_db' 'SELECT * FROM academic_groups ORDER BY name;'
    Show-Query 'assignment_db' 'SELECT e.student_name, g.name AS group_name FROM enrollments e JOIN academic_groups g ON g.id = e.group_id ORDER BY g.name, e.student_name;'
    Wait-Next
}

if ($Only -in @('all', 'audit')) {
    Write-Title '6. Журнал аудиту  (audit_db)'
    Write-Note 'Події пише gateway: входи, зміни, відмови в доступі.'
    Show-Query 'audit_db' 'SELECT action, user_name, status, status_code, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 12;'
    Wait-Next
}

if ($Only -in @('all', 'messages')) {
    Write-Title '7. Повідомлення  (communication_db)'
    Show-Query 'communication_db' 'SELECT count(*) AS messages FROM messages;'
}

Write-Host ''
Write-Host '  Готово. Дані не змінювались.' -ForegroundColor Green
Write-Host ''
exit 0
