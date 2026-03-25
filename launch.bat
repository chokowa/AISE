@echo off
chcp 65001 > nul
setlocal

echo ==================================================
echo  Starting AudioGen Premium Dashboard...
echo ==================================================

:: 1. Start Backend in a new window
echo Starting Backend (FastAPI)...
start "AudioGen-Backend" cmd /k "cd /d %~dp0 && .\venv\Scripts\activate && python audiogen_server.py"

:: 2. Start Frontend in a new window
echo Starting Frontend (Next.js)...
start "AudioGen-Frontend" cmd /k "cd /d %~dp0audiogen-web && npm run dev"

echo.
echo Launching browser in 8 seconds...
timeout /t 8 /nobreak > nul

:: 3. Open Web Browser
start http://localhost:3000

echo.
echo ==================================================
echo  All systems have been launched.
echo  Backend: http://127.0.0.1:8000
echo  Frontend: http://localhost:3000
echo ==================================================
pause
