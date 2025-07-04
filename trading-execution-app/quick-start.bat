@echo off
echo ====================================
echo Trading Execution App Quick Start
echo ====================================
echo.

REM Check if .env exists
if not exist ".env" (
    echo ERROR: .env file not found!
    echo.
    echo Please create a .env file with your API keys.
    echo You can copy env.example to .env and fill in your values.
    echo.
    echo Example:
    echo   copy env.example .env
    echo   notepad .env
    echo.
    pause
    exit /b 1
)

echo Checking Docker...
docker --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not installed or not running!
    echo Please install Docker Desktop from https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo.
echo Starting Trading Execution System...
echo.
echo This will:
echo 1. Start the backend API on http://localhost:3000
echo 2. Start the frontend UI on http://localhost:3001
echo 3. Connect to market data streams
echo 4. Initialize monitoring systems
echo.
echo Press Ctrl+C to stop the system at any time.
echo.
pause

echo.
echo Starting services with Docker Compose...
docker-compose up

pause 