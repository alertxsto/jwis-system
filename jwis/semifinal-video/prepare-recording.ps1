$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$python = "C:\Users\HP\AppData\Local\Programs\Python\Python312\python.exe"

try {
    Invoke-RestMethod -Uri "http://localhost:8000/api/demo/reset" -Method Post | Out-Null
} catch {
    Start-Process powershell -WindowStyle Hidden -WorkingDirectory "$root\backend" -ArgumentList "-NoExit", "-Command", "& '$python' -m uvicorn app.main:app --port 8000"
    Start-Sleep -Seconds 4
    Invoke-RestMethod -Uri "http://localhost:8000/api/demo/reset" -Method Post | Out-Null
}

try {
    Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing | Out-Null
} catch {
    Start-Process powershell -WindowStyle Hidden -WorkingDirectory "$root\frontend" -ArgumentList "-NoExit", "-Command", "npm run dev -- --port 5173"
    Start-Sleep -Seconds 4
}

try {
    Invoke-WebRequest -Uri "http://localhost:5190/cards.html" -UseBasicParsing | Out-Null
} catch {
    Start-Process powershell -WindowStyle Hidden -WorkingDirectory $PSScriptRoot -ArgumentList "-NoExit", "-Command", "& '$python' -m http.server 5190"
    Start-Sleep -Seconds 2
}

$health = Invoke-RestMethod -Uri "http://localhost:8000/api/health"
$snapshot = Invoke-RestMethod -Uri "http://localhost:8000/api/command-center"

Write-Host "JWIS recording environment is ready."
Write-Host "Backend: $($health.status)"
Write-Host "Active alerts: $($snapshot.alerts.Count)"
Write-Host "Command Center: http://localhost:5173"
Write-Host "Field App: http://localhost:5173/field"
Write-Host "Opening/Closing Cards: http://localhost:5190/cards.html"
