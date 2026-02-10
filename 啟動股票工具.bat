@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ========================================
echo   台股投資健康度檢視工具
echo ========================================
echo.
echo [1/3] 目前路徑: %CD%

echo [2/3] 啟動後端伺服器 (Yahoo Finance API)...
start "Stock API Server" /min cmd /c "node server.js"
timeout /t 2 /nobreak >nul

echo [3/3] 啟動前端開發伺服器...
start "Stock Frontend" /min cmd /c "npm run dev"
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo   正在使用 Chrome 開啟應用程式...
echo ========================================
echo.

:: 等待前端伺服器啟動
timeout /t 3 /nobreak >nul

:: 使用 Chrome 開啟
start chrome "http://localhost:5173"

echo.
echo 應用程式已在 Chrome 中開啟！
echo.
echo 若要關閉應用程式，請關閉此視窗以停止背景伺服器。
echo.
pause
taskkill /FI "WINDOWTITLE eq Stock API Server*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Stock Frontend*" /F >nul 2>&1
