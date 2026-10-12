@echo off
title Grievance System - Backend Server
color 0A
echo.
echo ========================================
echo   STARTING BACKEND SERVER
echo ========================================
echo.
pushd "%~dp0backend-node"
node server.js
pause
