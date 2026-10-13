@echo off
title DocuTrack Express v2.0 Pro
cls
echo ========================================================
echo         DOCUTRACK EXPRESS - CORRESPONDENCIA
echo ========================================================
echo.

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ALERTA] Node.js no se detecto en este equipo.
    echo Para ejecutar este sistema, instala Node.js (gratis):
    echo https://nodejs.org/
    echo.
    pause
    exit /b
)

echo [OK] Node.js detectado correctamente.
echo Iniciando servidor en puerto 3000...
echo.

timeout /t 2 >nul
start http://localhost:3000

node server-single-file.js
pause
