@echo off
REM ============================================================
REM  Запуск Маджонга как PWA-приложения в Chrome
REM  Положите этот файл в папку mahjong рядом с index.html
REM  Двойной клик — игра откроется как отдельное приложение
REM ============================================================

setlocal
cd /d "%~dp0"

REM Пытаемся найти Chrome
set "CHROME="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"

REM Если Chrome есть — открываем как приложение (без адресной строки)
if defined CHROME (
    start "" "%CHROME%" --app="file:///%~dp0index.html" --window-size=1280,800
    exit /b
)

REM Иначе — открываем в браузере по умолчанию
start "" "index.html"
endlocal
