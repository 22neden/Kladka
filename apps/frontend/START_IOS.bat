@echo off
cd /d "%~dp0"
title Kladka.UA - Expo
if not exist node_modules\expo\package.json (
  echo First run npm.cmd run setup from the parent KLADKA folder.
  pause
  exit /b 1
)
call npm.cmd start
pause
