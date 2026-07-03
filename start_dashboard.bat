@echo off
title Yatirim Dashboard
cd /d "%~dp0"
echo.
echo  === Yatirim Uygulamalari Dashboard ===
echo.
echo  Local sunucu baslatiliyor...
echo.
start "" http://localhost:8080/dashboard.html
python3 -m http.server 8080
pause
