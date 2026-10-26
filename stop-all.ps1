# ==============================================================================
# Studevo Learning Platform - Stop All Services Script
# ==============================================================================

Write-Host "Stopping Studevo LMS services..." -ForegroundColor Yellow

$ports = @(3000, 3001, 3002, 5173)
$stoppedCount = 0

foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connections) {
        $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($procId in $pids) {
            try {
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                Write-Host "  Stopped process $procId on port $port" -ForegroundColor Green
                $stoppedCount++
            } catch {}
        }
    }
}

if ($stoppedCount -eq 0) {
    Write-Host "No active Studevo services were running." -ForegroundColor Cyan
} else {
    Write-Host "All Studevo services have been stopped successfully!" -ForegroundColor Green
}
