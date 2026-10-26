# ==============================================================================
# Studevo Learning Platform - All-In-One Startup Script
# ==============================================================================

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Studevo LMS - Microservices & PostgreSQL Platform" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# 1. Check PostgreSQL service
Write-Host "`n[1/5] Checking PostgreSQL service..." -ForegroundColor Yellow
$pgService = Get-Service -Name "*postgres*" -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Running' }
if ($pgService) {
    Write-Host "  PostgreSQL service is running: $($pgService.Name)" -ForegroundColor Green
} else {
    Write-Host "  Starting PostgreSQL service..." -ForegroundColor Yellow
    Start-Service -Name "postgresql-x64-17" -ErrorAction SilentlyContinue
}

# 2. Start Course Service (Port 3001)
Write-Host "`n[2/5] Starting Course Service on port 3001..." -ForegroundColor Yellow
$courseJob = Start-Process -FilePath "node" -ArgumentList "services/course-service/dist/main.js" -WorkingDirectory $scriptDir -WindowStyle Hidden -PassThru
Write-Host "  Course Service started (PID: $($courseJob.Id))" -ForegroundColor Green

# 3. Start Assignment Service (Port 3002)
Write-Host "`n[3/5] Starting Assignment Service on port 3002..." -ForegroundColor Yellow
$asgJob = Start-Process -FilePath "node" -ArgumentList "services/assignment-service/dist/main.js" -WorkingDirectory $scriptDir -WindowStyle Hidden -PassThru
Write-Host "  Assignment Service started (PID: $($asgJob.Id))" -ForegroundColor Green

# 4. Start API Gateway (Port 3000)
Write-Host "`n[4/5] Starting API Gateway on port 3000..." -ForegroundColor Yellow
$gwJob = Start-Process -FilePath "node" -ArgumentList "services/api-gateway/dist/main.js" -WorkingDirectory $scriptDir -WindowStyle Hidden -PassThru
Write-Host "  API Gateway started (PID: $($gwJob.Id))" -ForegroundColor Green

# 5. Start Frontend Vite (Port 5173)
Write-Host "`n[5/5] Starting Frontend (Vite) on port 5173..." -ForegroundColor Yellow
$viteJob = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -WorkingDirectory $scriptDir -WindowStyle Hidden -PassThru
Write-Host "  Frontend started (PID: $($viteJob.Id))" -ForegroundColor Green

# Wait for startup
Write-Host "`nWaiting for services to initialize..." -ForegroundColor Cyan
Start-Sleep -Seconds 4

# Verify connections
Write-Host "`nService Status:" -ForegroundColor Cyan
$ports = @(3000, 3001, 3002, 5173)
foreach ($p in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue
    if ($conn) {
        Write-Host "  Port $p : ACTIVE" -ForegroundColor Green
    } else {
        Write-Host "  Port $p : starting up..." -ForegroundColor Yellow
    }
}

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "  Studevo Platform is READY!" -ForegroundColor Green
Write-Host "  Web App:       http://localhost:5173" -ForegroundColor White
Write-Host "  API Gateway:   http://localhost:3000" -ForegroundColor White
Write-Host "  Course Docs:   http://localhost:3001/api/docs" -ForegroundColor White
Write-Host "  Assign Docs:   http://localhost:3002/api/docs" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Green

Start-Process "http://localhost:5173"
