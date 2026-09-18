@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build.ps1"
if errorlevel 1 (echo KAANTO EPAONNISTUI) else (echo KAANTO VALMIS - tuo .tgz-paketti Companionin Modules-sivulla)
pause
