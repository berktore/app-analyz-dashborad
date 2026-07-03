@echo off
title Yatirim Dashboard
cd /d "%~dp0"
echo.
echo  === Yatirim Uygulamalari Dashboard ===
echo.
echo  Local sunucu baslatiliyor...
echo.
start python -m http.server 8080
timeout /t 2 /nobreak >nul
start http://localhost:8080/dashboard.html
echo  Tarayici aciliyor...
echo.
pause
