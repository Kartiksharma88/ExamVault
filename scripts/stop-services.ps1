# Stop all ExamVault processes and free ports 3001, 5173, 8000
param(
    [switch]$Quiet
)

$targetPorts = @(3001, 5173, 8000)
$stoppedCount = 0

if (-not $Quiet) {
    Write-Host "=================================================" -ForegroundColor Cyan
    Write-Host "         Stopping ExamVault Services             " -ForegroundColor Yellow
    Write-Host "=================================================" -ForegroundColor Cyan
}

# 1. Terminate processes listening on target ports (with full process tree termination)
foreach ($port in $targetPorts) {
    try {
        $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        if ($connections) {
            $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
            foreach ($processId in $pids) {
                if ($processId -gt 0) {
                    try {
                        $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
                        $procName = if ($proc) { $proc.ProcessName } else { "Unknown" }
                        
                        # Use taskkill with /T to terminate the entire process tree (node, python, uvicorn, etc.)
                        Start-Process -FilePath "taskkill.exe" -ArgumentList "/F /T /PID $processId" -WindowStyle Hidden -Wait -ErrorAction SilentlyContinue
                        $stoppedCount++
                        if (-not $Quiet) {
                            Write-Host "  [OK] Terminated $procName (PID $processId) on port $port" -ForegroundColor Green
                        }
                    } catch {
                        # Ignore if already exited
                    }
                }
            }
        } else {
            if (-not $Quiet) {
                Write-Host "  [-] Port $port is already free" -ForegroundColor DarkGray
            }
        }
    } catch {
        # Fallback using netstat if Get-NetTCPConnection fails
        try {
            $lines = netstat -aon | Select-String ":$port\s+.*LISTENING"
            foreach ($line in $lines) {
                $tokens = ($line.ToString().Trim() -split '\s+')
                $netstatPid = $tokens[-1]
                if ($netstatPid -match '^\d+$' -and [int]$netstatPid -gt 0) {
                    Start-Process -FilePath "taskkill.exe" -ArgumentList "/F /T /PID $netstatPid" -WindowStyle Hidden -Wait -ErrorAction SilentlyContinue
                    if (-not $Quiet) {
                        Write-Host "  [OK] Terminated process (PID $netstatPid) on port $port" -ForegroundColor Green
                    }
                }
            }
        } catch {}
    }
}

# 2. Terminate any ExamVault-titled cmd windows
try {
    $examvaultWindows = Get-Process -ErrorAction SilentlyContinue | Where-Object { 
        $_.MainWindowTitle -like "ExamVault*" 
    }
    foreach ($win in $examvaultWindows) {
        Start-Process -FilePath "taskkill.exe" -ArgumentList "/F /T /PID $($win.Id)" -WindowStyle Hidden -Wait -ErrorAction SilentlyContinue
        if (-not $Quiet) {
            Write-Host "  [OK] Closed window '$($win.MainWindowTitle)' (PID $($win.Id))" -ForegroundColor Green
        }
    }
} catch {}

if (-not $Quiet) {
    Write-Host "-------------------------------------------------" -ForegroundColor Cyan
    Write-Host " All ExamVault services stopped successfully.    " -ForegroundColor Green
    Write-Host "=================================================" -ForegroundColor Cyan
}
