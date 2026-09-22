@echo off
title JWIS Launch All
echo ============================================
echo  JWIS - Launching all services (3 windows)
echo ============================================
echo.
echo [1/3] Starting WhatsApp Gateway (Baileys, port 2785)...
start "JWIS - WA Gateway" cmd /k "cd /d "%~dp0backend\wa-gateway" && node server.js"

echo [2/3] Starting Backend API (FastAPI, port 8001)...
start "JWIS - Backend API" cmd /k "cd /d "%~dp0backend" && C:\Users\HP\AppData\Local\Programs\Python\Python312\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001"

echo [3/3] Starting Frontend (Vite dev, port 5173)...
start "JWIS - Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo     Waiting for services to start...
timeout /t 8 /nobreak >nul
start http://localhost:5173
echo.
echo  All services launched. Dashboard: http://localhost:5173
echo  Close each window to stop its service.
echo.