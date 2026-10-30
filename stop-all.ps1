# ============================================================================
#  Studevo LMS — остановка всех сервисов
#
#  .\stop-all.ps1              остановить локальные процессы
#  .\stop-all.ps1 -Docker      дополнительно остановить контейнеры compose
# ============================================================================
[CmdletBinding()]
param(
    [switch]$Docker
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    $msg" -ForegroundColor Yellow }

Write-Host '==========================================================' -ForegroundColor Cyan
Write-Host '  Studevo LMS — остановка' -ForegroundColor Cyan
Write-Host '==========================================================' -ForegroundColor Cyan

$pidsFile = Join-Path $root 'logs/pids.json'
$stopped = 0
$ports = @(3000, 3001, 3002, 3003, 3004, 5173)

function Stop-ByPid([int]$procId, [string]$name) {
    try {
        $p = Get-Process -Id $procId -ErrorAction Stop
        Stop-Process -Id $procId -Force -ErrorAction Stop
        Write-Ok "$name (PID $procId) остановлен"
        return $true
    } catch {
        return $false
    }
}

if (Test-Path $pidsFile) {
    Write-Step 'Остановка процессов из logs/pids.json'
    try {
        $procs = Get-Content $pidsFile -Raw | ConvertFrom-Json
        foreach ($p in @($procs)) {
            if (Stop-ByPid ([int]$p.pid) $p.name) { $script:stopped++ }
        }
    } catch {
        Write-Warn "Не удалось прочитать pids.json: $($_.Exception.Message)"
    }
}

Write-Step 'Освобождение портов'
foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if (-not $connections) { continue }
    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $pids) {
        if ($procId -eq 0) { continue }
        if (Stop-ByPid ([int]$procId) "процесс на порту $port") { $script:stopped++ }
    }
}

if ($Docker) {
    Write-Step 'Остановка контейнеров docker compose'
    docker compose stop
    if ($LASTEXITCODE -eq 0) { Write-Ok 'Контейнеры остановлены (данные сохранены в volumes)' }
    else { Write-Warn 'docker compose stop завершился с ошибкой (Docker запущен?)' }
}

Remove-Item $pidsFile -ErrorAction SilentlyContinue

Write-Host ''
if ($stopped -eq 0) { Write-Warn 'Активных процессов Studevo не найдено' }
else { Write-Ok "Остановлено процессов: $stopped" }
Write-Host ''
