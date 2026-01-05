@echo off
echo ========================================
echo   GodForge README Agent - Backend
echo ========================================
echo.
echo [1/2] Checking API key...
echo.

cd /d "%~dp0backend"

python -c "from dotenv import load_dotenv; import os; load_dotenv(); key = os.getenv('GEMINI_API_KEY'); exit(0 if key and key != '' else 1)"

if errorlevel 1 (
    echo ERROR: API key not configured!
    echo.
    echo Please edit: backend\.env
    echo Add your Gemini API key after GEMINI_API_KEY=
    echo.
    echo Get your free key from:
    echo https://aistudio.google.com/app/apikey
    echo.
    pause
    exit /b 1
)

echo [2/2] Starting Flask server...
echo.
python app.py

if errorlevel 1 (
    echo.
    echo ERROR: Server failed to start!
    echo Check the error message above.
    echo.
    pause
)

