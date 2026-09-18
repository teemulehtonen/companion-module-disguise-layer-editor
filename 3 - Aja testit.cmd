@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build.ps1" -TestOnly
if errorlevel 1 (echo TESTIT EPAONNISTUIVAT) else (echo TESTIT OK)
pause
