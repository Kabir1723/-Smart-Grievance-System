@echo off
title Grievance System - Frontend Server
color 0B
echo.
echo ========================================
echo   STARTING FRONTEND SERVER
echo ========================================
echo.
pushd "%~dp0frontend"
npm start
pause
