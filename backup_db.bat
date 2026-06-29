@echo off
chcp 65001 >nul
:: ============================================================
::  Záloha PostgreSQL – AI Konfigurátor Factoryshop.cz
::  Spouštět automaticky přes Plánovač úloh Windows (denně)
:: ============================================================

:: ── Konfigurace ──────────────────────────────────────────────
set DB_NAME=factoryshop_konfigurator
set DB_USER=postgres
set DB_HOST=localhost
set DB_PORT=5432
set BACKUP_DIR=C:\Backups\factoryshop-db
set KEEP_DAYS=30

:: Heslo – doporučujeme uložit jako Windows credential místo zde
:: Pro testování lze nastavit přímo:
:: set PGPASSWORD=vase_heslo

:: ── Datum pro jméno souboru ───────────────────────────────────
for /f "tokens=1-3 delims=." %%a in ("%date%") do (
  set DAY=%%a
  set MONTH=%%b
  set YEAR=%%c
)
set DATE_STR=%YEAR%-%MONTH%-%DAY%
set TIME_STR=%TIME:~0,2%-%TIME:~3,2%
set TIME_STR=%TIME_STR: =0%
set FILENAME=backup_%DATE_STR%_%TIME_STR%.dump

:: ── Vytvoření složky pro zálohy ──────────────────────────────
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

:: ── Kontrola pg_dump ─────────────────────────────────────────
where pg_dump >nul 2>&1
if errorlevel 1 (
    echo [CHYBA] pg_dump nenalezen. Přidejte PostgreSQL\bin do PATH.
    exit /b 1
)

:: ── Záloha ───────────────────────────────────────────────────
echo [%date% %time%] Spouštím zálohu databáze %DB_NAME%...
pg_dump -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -F c -f "%BACKUP_DIR%\%FILENAME%"

if errorlevel 1 (
    echo [CHYBA] Záloha selhala!
    exit /b 1
)

echo [OK] Záloha uložena: %BACKUP_DIR%\%FILENAME%

:: ── Smazání starých záloh ────────────────────────────────────
echo [INFO] Mažu zálohy starší než %KEEP_DAYS% dní...
forfiles /p "%BACKUP_DIR%" /m *.dump /d -%KEEP_DAYS% /c "cmd /c del @file" 2>nul

echo [HOTOVO] Záloha dokončena.
