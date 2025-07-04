@echo off

REM Production deployment script for Windows
echo Starting deployment...

REM Check environment
if "%1"=="" (
    echo Usage: deploy.bat [production^|staging]
    exit /b 1
)

set ENV=%1
echo Deploying to: %ENV%

REM Check if environment file exists
if not exist ".env.%ENV%" (
    echo Error: .env.%ENV% file not found
    exit /b 1
)

REM Build and test
echo Building application...
docker-compose build

echo Running tests...
docker-compose run --rm backend npm test
docker-compose run --rm frontend npm test

REM Deploy
echo Starting services...
docker-compose up -d

REM Health check
echo Checking health...
timeout /t 10 /nobreak > nul
curl -f http://localhost:3000/health
if errorlevel 1 (
    echo Health check failed!
    exit /b 1
)

echo Deployment complete!

REM Show status
docker-compose ps 