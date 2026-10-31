# Запуск psql із правильним UTF-8, щоб українські літери не ламалися.
#
# Приклади:
#   .\scripts\db-console.ps1
#   .\scripts\db-console.ps1 -Database auth_db
#   .\scripts\db-console.ps1 -Database assignment_db -Query "SELECT * FROM grades;"

param(
    [ValidateSet('auth_db', 'course_db', 'assignment_db', 'audit_db', 'communication_db')]
    [string]$Database = 'assignment_db',
    [string]$Query
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

# UTF-8 для консолі та для клієнта PostgreSQL.
try {
    chcp 65001 > $null
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
    $env:PGCLIENTENCODING = 'UTF8'
} catch { }

# Пароль із .env (не показуємо його в консолі).
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

if ($Query) {
    & $psql -h localhost -p 5432 -U postgres -d $Database -P pager=off -c $Query
} else {
    Write-Host "psql → $Database. Для виходу: \q" -ForegroundColor DarkGray
    & $psql -h localhost -p 5432 -U postgres -d $Database -P pager=off
}
