@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\release.ps1"
if errorlevel 1 (echo JULKAISUN RAKENNUS EPAONNISTUI) else (echo JULKAISUPAKETTI VALMIS - releases\0.1.beta)
pause
