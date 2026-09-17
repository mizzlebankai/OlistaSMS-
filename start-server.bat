@echo off
cd /d "%~dp0"
echo Starting Olistar School Portal...
where node >nul 2>nul
if %errorlevel% equ 0 (
    node server.js
) else (
    echo Opening on http://127.0.0.1:5500/login.html
    python -m http.server 5500
)
