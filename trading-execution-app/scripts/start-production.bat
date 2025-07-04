@echo off
echo Starting Trading Execution System in Production Mode

REM Verify environment
if not exist ".env.production" (
    echo Error: .env.production not found
    exit /b 1
)

REM Load environment variables
for /f "delims=" %%x in (.env.production) do (set "%%x")

REM Start services
echo Starting services...
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

REM Wait for services
echo Waiting for services to start...
timeout /t 30 /nobreak

REM Health checks
echo Running health checks...
curl -f http://localhost:3000/health
if errorlevel 1 exit /b 1

curl -f http://localhost:3001
if errorlevel 1 exit /b 1

echo System started successfully!
echo Dashboard: http://localhost:3001
echo Monitoring: http://localhost:3002
echo Logs: docker-compose logs -f 