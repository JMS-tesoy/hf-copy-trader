@echo off
setlocal
if "%~1"=="" (
  echo Usage: check-user.bat user@email.com
  exit /b 1
)
set SCRIPT_DIR=%~dp0
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%check-user.ps1" -Email "%~1"
endlocal
