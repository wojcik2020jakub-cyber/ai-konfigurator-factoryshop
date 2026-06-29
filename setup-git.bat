@echo off
chcp 65001 >nul
echo.
echo ================================================
echo  AI Konfigurátor – Git inicializace
echo ================================================
echo.

cd /d "%~dp0"

:: Kontrola git instalace
git --version >nul 2>&1
if errorlevel 1 (
    echo [CHYBA] Git není nainstalovaný nebo není v PATH.
    echo        Stáhněte na: https://git-scm.com/download/win
    pause
    exit /b 1
)

echo [1/5] Inicializuji Git repozitář...
git init -b main
if errorlevel 1 (
    echo [INFO] Pokus s výchozí větví...
    git init
    git checkout -b main 2>nul || git branch -m master main 2>nul
)

echo.
echo [2/5] Nastavuji identitu (změňte pokud chcete jiné jméno/email)...
git config user.name "Jakub Wojcik"
git config user.email "wojcik2020jakub@gmail.com"

echo.
echo [3/5] Přidávám soubory do stage...
git add .

echo.
echo [4/5] Vytvářím první commit...
git commit -m "feat: initial commit – AI konfigurator banneru v1.0"

echo.
echo [5/5] Stav repozitáře:
git log --oneline -3
git status

echo.
echo ================================================
echo  HOTOVO! Repozitář je inicializovaný.
echo.
echo  Další kroky pro GitHub:
echo  1. Vytvořte SOUKROMÝ repozitář na https://github.com/new
echo  2. Spusťte:
echo     git remote add origin https://github.com/VAS_USERNAME/ai-konfigurator-factoryshop.git
echo     git push -u origin main
echo ================================================
echo.
pause
