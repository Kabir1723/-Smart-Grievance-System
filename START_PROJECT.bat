@echo off
title Smart Public Grievance Escalation System
color 0E

echo.
echo ========================================================
echo        SMART PUBLIC GRIEVANCE ESCALATION SYSTEM
echo ========================================================
echo.

echo [1/2] Starting Backend Server...
start "Backend Server" cmd /k "pushd "%~dp0backend-node" && node server.js"

timeout /t 5 /nobreak >nul

echo [2/2] Starting Frontend Server...
start "Frontend Server" cmd /k "pushd "%~dp0frontend" && npm start"

timeout /t 12 /nobreak >nul

echo.
echo ========================================================
echo   Backend:  http://localhost:5000
echo   Frontend: http://localhost:3000
echo   Admin:    http://localhost:3000/admin
echo   Email:    admin@grievance.com
echo   Password: admin123
echo ========================================================
echo.
echo Opening browser...
start http://localhost:3000
echo.
echo Keep the Backend and Frontend windows open!
pause
