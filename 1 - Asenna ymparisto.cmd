@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup.ps1"
if errorlevel 1 (echo ASENNUS EPAONNISTUI) else (echo ASENNUS VALMIS)
pause
