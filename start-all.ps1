# ============================================================================
#  Studevo LMS — локальный запуск всего стека (Windows / PowerShell)
#
#  Режимы инфраструктуры:
#    -Infra docker  PostgreSQL/Redis/MinIO поднимаются через docker compose
#    -Infra local   используется локально установленный PostgreSQL/Redis
#    -Infra auto    docker, если он доступен, иначе local  (по умолчанию)
#
#  Примеры:
#    .\start-all.ps1
#    .\start-all.ps1 -SkipBuild
#    .\start-all.ps1 -Infra local
# ============================================================================
[CmdletBinding()]
param(
    [ValidateSet('auto', 'local', 'docker')]
    [string]$Infra = 'auto',
    [switch]$SkipBuild,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "    $msg" -ForegroundColor Red }

Write-Host '==========================================================' -ForegroundColor Cyan
Write-Host '  Studevo LMS — запуск платформы' -ForegroundColor Cyan
Write-Host '==========================================================' -ForegroundColor Cyan

# ---------------------------------------------------------------- .env
$envFile = Join-Path $root '.env'
if (-not (Test-Path $envFile)) {
    Copy-Item (Join-Path $root '.env.example') $envFile
    Write-Warn '.env создан из .env.example — проверьте значения'
}

function Read-DotEnv([string]$path) {
    $map = @{}
    if (-not (Test-Path $path)) { return $map }
    foreach ($raw in Get-Content $path) {
        $line = $raw.Trim()
        if (-not $line -or $line.StartsWith('#')) { continue }
        $idx = $line.IndexOf('=')
        if ($idx -lt 1) { continue }
        $key = $line.Substring(0, $idx).Trim()
        $val = $line.Substring($idx + 1).Trim()
        if ($val -match '^"(.*)"$') { $val = $Matches[1] }
        elseif ($val -match "^'(.*)'$") { $val = $Matches[1] }
        $map[$key] = $val
    }
    return $map
}

$cfg = Read-DotEnv $envFile
function Cfg($key, $default) {
    if ($cfg.ContainsKey($key) -and $cfg[$key]) { return $cfg[$key] }
    return $default
}

$logsDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

# ---------------------------------------------------------------- infrastructure
function Test-Docker {
    try {
        $null = docker info --format '{{.ServerVersion}}' 2>$null
        return ($LASTEXITCODE -eq 0)
    } catch { return $false }
}

if ($Infra -eq 'auto') {
    if (Test-Docker) { $Infra = 'docker' } else { $Infra = 'local' }
}

$dbHost = 'localhost'
$dbUser = Cfg 'DB_USER' 'postgres'
$dbPassword = Cfg 'DB_PASSWORD' 'postgres'
$redisHost = 'localhost'
$redisPort = Cfg 'REDIS_PORT' '6379'

if ($Infra -eq 'docker') {
    Write-Step '[1/6] Инфраструктура: docker compose (PostgreSQL x3, Redis, MinIO)'
    if (-not (Test-Docker)) {
        Write-Err 'Docker недоступен. Запустите Docker Desktop или используйте -Infra local.'
        exit 1
    }
    docker compose up -d course-db assignment-db auth-db redis_broker minio
    if ($LASTEXITCODE -ne 0) { Write-Err 'docker compose завершился с ошибкой'; exit 1 }

    $containers = @(
        @{ Name = 'studevo_course_db';     Db = (Cfg 'COURSE_DB_NAME' 'course_db') },
        @{ Name = 'studevo_assignment_db'; Db = (Cfg 'ASSIGNMENT_DB_NAME' 'assignment_db') },
        @{ Name = 'studevo_auth_db';       Db = (Cfg 'AUTH_DB_NAME' 'auth_db') }
    )
    foreach ($c in $containers) {
        $ready = $false
        for ($i = 0; $i -lt 40; $i++) {
            $status = (docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $c.Name 2>$null)
            if ($status -eq 'healthy') { $ready = $true; break }
            Start-Sleep -Milliseconds 750
        }
        if ($ready) { Write-Ok "$($c.Name) ($($c.Db)) — healthy" }
        else { Write-Warn "$($c.Name) не перешёл в healthy, продолжаем..." }
    }

    $courseDbPort     = Cfg 'COURSE_DB_PORT' '5433'
    $assignmentDbPort = Cfg 'ASSIGNMENT_DB_PORT' '5434'
    $authDbPort       = Cfg 'AUTH_DB_PORT' '5435'
}
else {
    Write-Step '[1/6] Инфраструктура: локальный PostgreSQL/Redis'
    $localPort = Cfg 'DB_PORT' '5432'
    $courseDbPort = $localPort
    $assignmentDbPort = $localPort
    $authDbPort = $localPort
    Write-Ok "PostgreSQL: ${dbHost}:${localPort} (БД: course_db, assignment_db, auth_db)"

    $psql = Get-Command psql -ErrorAction SilentlyContinue
    if ($psql) {
        $env:PGPASSWORD = $dbPassword
        foreach ($db in @((Cfg 'COURSE_DB_NAME' 'course_db'), (Cfg 'ASSIGNMENT_DB_NAME' 'assignment_db'), (Cfg 'AUTH_DB_NAME' 'auth_db'))) {
            $exists = & psql -h $dbHost -p $localPort -U $dbUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$db'" 2>$null
            if ($exists -ne '1') {
                & psql -h $dbHost -p $localPort -U $dbUser -d postgres -c "CREATE DATABASE $db" 2>&1 | Out-Null
                Write-Warn "Создана база $db"
            }
        }
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
    else {
        Write-Warn 'psql не найден — создайте БД course_db, assignment_db, auth_db вручную'
    }
}

# ---------------------------------------------------------------- build
Write-Step '[2/6] Сборка сервисов'
if ($SkipBuild) {
    Write-Warn 'Пропущено (-SkipBuild)'
}
else {
    npm run build:services
    if ($LASTEXITCODE -ne 0) { Write-Err 'Сборка сервисов не удалась'; exit 1 }
    Write-Ok 'Сервисы собраны'
}

$services = @(
    @{ Name = 'auth';       Entry = 'services/auth-service/dist/main.js';       Port = (Cfg 'AUTH_SERVICE_PORT' '3003');       DbName = (Cfg 'AUTH_DB_NAME' 'auth_db');              DbPort = $authDbPort },
    @{ Name = 'course';     Entry = 'services/course-service/dist/main.js';     Port = (Cfg 'COURSE_SERVICE_PORT' '3001');     DbName = (Cfg 'COURSE_DB_NAME' 'course_db');          DbPort = $courseDbPort },
    @{ Name = 'assignment'; Entry = 'services/assignment-service/dist/main.js'; Port = (Cfg 'ASSIGNMENT_SERVICE_PORT' '3002'); DbName = (Cfg 'ASSIGNMENT_DB_NAME' 'assignment_db');  DbPort = $assignmentDbPort },
    @{ Name = 'gateway';    Entry = 'services/api-gateway/dist/main.js';        Port = (Cfg 'GATEWAY_PORT' '3000');            DbName = $null;                                       DbPort = $null }
)

foreach ($svc in $services) {
    $entryPath = Join-Path $root $svc.Entry
    if (-not (Test-Path $entryPath)) {
        Write-Err "Не найден $($svc.Entry). Запустите без -SkipBuild."
        exit 1
    }
}

# ---------------------------------------------------------------- start
Write-Step '[3/6] Запуск микросервисов'

# общие переменные окружения
$env:NODE_ENV = 'development'
$env:DB_HOST = $dbHost
$env:DB_USER = $dbUser
$env:DB_PASSWORD = $dbPassword
$env:REDIS_HOST = $redisHost
$env:REDIS_PORT = $redisPort
$env:JWT_SECRET = (Cfg 'JWT_SECRET' 'change_me_super_long_random_secret_at_least_32_chars')
$env:JWT_EXPIRES_IN = (Cfg 'JWT_EXPIRES_IN' '8h')
$env:CORS_ORIGINS = (Cfg 'CORS_ORIGINS' 'http://localhost:5173,http://localhost:8080')
$env:SEED_DEMO_DATA = (Cfg 'SEED_DEMO_DATA' 'true')
$env:DEMO_PASSWORD = (Cfg 'DEMO_PASSWORD' '123456')
$env:S3_ENDPOINT = (Cfg 'S3_ENDPOINT' 'http://localhost:9000')
$env:S3_ACCESS_KEY = (Cfg 'S3_ACCESS_KEY' 'minio_admin')
$env:S3_SECRET_KEY = (Cfg 'S3_SECRET_KEY' 'minio_secret_key')
$env:S3_BUCKET = (Cfg 'S3_BUCKET' 'lms-files')
$env:S3_FORCE_PATH_STYLE = (Cfg 'S3_FORCE_PATH_STYLE' 'true')
$env:COURSE_SERVICE_URL = (Cfg 'COURSE_SERVICE_URL' 'http://localhost:3001')
$env:ASSIGNMENT_SERVICE_URL = (Cfg 'ASSIGNMENT_SERVICE_URL' 'http://localhost:3002')
$env:AUTH_SERVICE_URL = (Cfg 'AUTH_SERVICE_URL' 'http://localhost:3003')

$started = @()

foreach ($svc in $services) {
    $out = Join-Path $logsDir "$($svc.Name).out.log"
    $err = Join-Path $logsDir "$($svc.Name).err.log"
    Remove-Item $out, $err -ErrorAction SilentlyContinue

    $env:PORT = $svc.Port
    if ($svc.DbName) {
        $env:DB_NAME = $svc.DbName
        $env:DB_PORT = $svc.DbPort
        $env:USE_POSTGRES = 'true'
    }

    $proc = Start-Process -FilePath 'node' -ArgumentList $svc.Entry -WorkingDirectory $root `
        -WindowStyle Hidden -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
    $started += [pscustomobject]@{ name = $svc.Name; pid = $proc.Id; port = [int]$svc.Port; log = $out; errLog = $err }
    Write-Ok "$($svc.Name) — PID $($proc.Id), порт $($svc.Port)"
}

# ---------------------------------------------------------------- wait for health
Write-Step '[4/6] Ожидание готовности сервисов'
function Wait-Service([int]$port, [string]$name, [int]$timeoutSec = 60) {
    $deadline = (Get-Date).AddSeconds($timeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $resp = Invoke-WebRequest -Uri "http://localhost:$port/health" -UseBasicParsing -TimeoutSec 3
            if ($resp.StatusCode -eq 200) { return $true }
        } catch { }
        Start-Sleep -Milliseconds 700
    }
    Write-Err "$name не ответил на /health за $timeoutSec c"
    $errLog = Join-Path $logsDir "$name.err.log"
    if (Test-Path $errLog) {
        Write-Host '    --- последние строки лога ---' -ForegroundColor DarkGray
        Get-Content $errLog -Tail 15 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
    }
    return $false
}

$allHealthy = $true
foreach ($s in $started) {
    $ok = Wait-Service $s.port $s.name
    if ($ok) { Write-Ok "$($s.name) — UP (http://localhost:$($s.port))" }
    else { $allHealthy = $false }
}

# ---------------------------------------------------------------- frontend
Write-Step '[5/6] Запуск фронтенда (Vite)'
$viteOut = Join-Path $logsDir 'frontend.out.log'
$viteErr = Join-Path $logsDir 'frontend.err.log'
Remove-Item $viteOut, $viteErr -ErrorAction SilentlyContinue
$viteProc = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'npm run dev' -WorkingDirectory $root `
    -WindowStyle Hidden -PassThru -RedirectStandardOutput $viteOut -RedirectStandardError $viteErr
$started += [pscustomobject]@{ name = 'frontend'; pid = $viteProc.Id; port = 5173; log = $viteOut; errLog = $viteErr }
Write-Ok "frontend — PID $($viteProc.Id), порт 5173"

$viteOk = $false
$deadline = (Get-Date).AddSeconds(45)
while ((Get-Date) -lt $deadline) {
    try {
        $resp = Invoke-WebRequest -Uri 'http://localhost:5173/' -UseBasicParsing -TimeoutSec 3
        if ($resp.StatusCode -eq 200) { $viteOk = $true; break }
    } catch { }
    Start-Sleep -Milliseconds 700
}

$started | ConvertTo-Json -Depth 4 | Set-Content -Path (Join-Path $logsDir 'pids.json') -Encoding UTF8

# ---------------------------------------------------------------- summary
Write-Step '[6/6] Итог'
Write-Host ''
Write-Ok "Frontend:        http://localhost:5173"
Write-Ok "API Gateway:     http://localhost:$(Cfg 'GATEWAY_PORT' '3000')/health"
Write-Ok "Course docs:     http://localhost:$(Cfg 'COURSE_SERVICE_PORT' '3001')/api/docs"
Write-Ok "Assignment docs: http://localhost:$(Cfg 'ASSIGNMENT_SERVICE_PORT' '3002')/api/docs"
Write-Ok "Auth docs:       http://localhost:$(Cfg 'AUTH_SERVICE_PORT' '3003')/api/docs"
Write-Ok "MinIO console:   http://localhost:$(Cfg 'MINIO_CONSOLE_PORT' '9001')  (если Infra=docker)"
Write-Host ''
Write-Ok "Логи: $logsDir"
Write-Host ''

if (-not $allHealthy) {
    Write-Err 'Не все сервисы поднялись. Проверьте логи выше — приложение может работать в демо-режиме на локальном кэше.'
}

if (-not $NoBrowser -and $viteOk) {
    Start-Process 'http://localhost:5173'
}

if (-not $viteOk) {
    Write-Err 'Vite не ответил за 45 c — смотрите logs/frontend.err.log'
    exit 1
}
