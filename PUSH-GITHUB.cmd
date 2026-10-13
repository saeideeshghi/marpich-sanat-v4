@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0PUSH-GITHUB.ps1"
set "MPS_EXIT_CODE=%errorlevel%"
pause
exit /b %MPS_EXIT_CODE%
