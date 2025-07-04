@echo off

REM Start Docker containers for development
echo Starting Trading Execution App...

REM Check if .env file exists
if not exist ".env" (
    echo Warning: .env file not found!
    echo Creating .env from .env.example...
    copy backend\env.example .env
    echo Please edit .env with your API keys before running again.
    exit /b 1
)

REM Check Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo Error: Docker is not running. Please start Docker Desktop.
    exit /b 1
)

REM Build containers
echo Building containers...
docker-compose build

REM Start services
echo Starting services...
docker-compose up -d

REM Wait for services to be ready
echo Waiting for services to start...
timeout /t 10 /nobreak > nul

REM Check health
echo Checking service health...
curl -f http://localhost:3000/health >nul 2>&1
if errorlevel 1 (
    echo Backend health check failed
    docker-compose logs backend
) else (
    echo Backend is healthy!
)

echo.
echo Application is running!
echo Frontend: http://localhost:3001
echo Backend API: http://localhost:3000
echo Health Check: http://localhost:3000/health
echo.
echo View logs: docker-compose logs -f
echo Stop services: docker-compose down 