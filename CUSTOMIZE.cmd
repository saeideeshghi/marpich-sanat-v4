@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
    echo Node.js is missing. Install Node 24 and reopen this window.
    pause
    exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
    echo npm is missing. Reinstall Node.js with npm enabled.
    pause
    exit /b 1
)
call npm run customize
if errorlevel 1 (
    echo Launch failed. Read the error above or .cache\customizer-start.log
    pause
    exit /b 1
)
