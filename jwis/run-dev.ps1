$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = "C:\Users\HP\AppData\Local\Programs\Python\Python312\python.exe"

Write-Host "========================================" -ForegroundColor Green
Write-Host "  JWIS Winning System - Launcher        " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Check Python interpreter
if (!(Test-Path $python)) {
    Write-Host "[ERROR] Python312 not found at $python" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Python: $python" -ForegroundColor Cyan

# Check node_modules
if (!(Test-Path "$root\frontend\node_modules")) {
    Write-Host "[SETUP] Installing frontend dependencies..." -ForegroundColor Yellow
    Push-Location "$root\frontend"
    npm install
    Pop-Location
}
Write-Host "[OK] Frontend node_modules ready" -ForegroundColor Cyan

# Start Backend (FastAPI on port 8001)
Write-Host "`n[STARTING] Backend (FastAPI) on port 8001..." -ForegroundColor Yellow
Start-Process powershell -WorkingDirectory "$root\backend" -ArgumentList "-NoExit", "-Command", @"
`$env:PYTHONIOENCODING='utf-8'
`$env:PYTHONPATH='$root\backend'
`$env:JWIS_AI_ENGINE='on'
Write-Host 'Backend starting...' -ForegroundColor Green
& '$python' -m uvicorn app.main:app --reload --port 8001
"@

# Start Frontend (Vite on port 5175)
Write-Host "[STARTING] Frontend (Vite) on port 5175..." -ForegroundColor Yellow
Start-Process powershell -WorkingDirectory "$root\frontend" -ArgumentList "-NoExit", "-Command", @"
`$env:VITE_API_URL='http://127.0.0.1:8001/api'
Write-Host 'Frontend starting...' -ForegroundColor Green
npm run dev -- --port 5175
"@

# Wait for services to be ready
Write-Host "`n[WAITING] Checking services..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Verify backend
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8001/docs" -UseBasicParsing -TimeoutSec 10
    Write-Host "[OK] Backend API   : http://localhost:8001/docs  (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "[WARN] Backend not ready yet — wait a few more seconds" -ForegroundColor Yellow
}

# Verify frontend
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5175" -UseBasicParsing -TimeoutSec 10
    Write-Host "[OK] Frontend UI   : http://localhost:5175        (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "[WARN] Frontend not ready yet — wait a few more seconds" -ForegroundColor Yellow
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  JWIS System is LIVE!                  " -ForegroundColor Green
Write-Host "  Command Center : http://localhost:5175" -ForegroundColor Cyan
Write-Host "  Field App      : http://localhost:5175/field" -ForegroundColor Cyan
Write-Host "  API Docs       : http://localhost:8001/docs" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Green
Write-Host "`nPress any key to close this launcher..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
