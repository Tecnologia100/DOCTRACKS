@echo off
cd /d "%~dp0"
title DocuTrack Express v2.0 Pro
cls

echo ========================================================
echo         DOCUTRACK EXPRESS - CORRESPONDENCIA
echo ========================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] No se detecto Node.js en este equipo.
    echo.
    echo Para ejecutar la aplicacion, por favor descargue e instale
    echo Node.js de forma gratuita desde: https://nodejs.org
    echo.
    echo Presione una tecla para salir...
    pause
    exit /b 1
)

echo [OK] Node.js detectado correctamente.
echo.

netstat -ano | findstr :3000 | findstr LISTENING >nul 2>&1
if not errorlevel 1 (
    echo [INFORMACION] El servidor DocuTrack ya se encuentra activo en el puerto 3000.
    echo Abriendo la aplicacion en su navegador web...
    start http://localhost:3000
    echo.
    echo La aplicacion esta abierta en su navegador en http://localhost:3000
    echo Puede minimizar o cerrar esta ventana cuando lo desee.
    echo.
    pause
    exit /b 0
)

echo Iniciando servidor en puerto 3000...
echo Abriendo aplicacion en el navegador web...
start http://localhost:3000
echo.
echo Presione Ctrl+C en esta ventana si desea detener el servidor.
echo.

node server-single-file.js

if errorlevel 1 (
    echo.
    echo El servidor ha finalizado.
    pause
)
