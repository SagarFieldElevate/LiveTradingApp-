# Docker Deployment Guide

## Prerequisites

- Docker Desktop installed
- Docker Compose installed
- API keys for:
  - Pinecone
  - OpenAI
  - Polygon.io
  - Slack (optional)

## Quick Start

### 1. Setup Environment

```bash
# Copy environment template
cp backend/env.example .env

# Edit .env with your API keys
nano .env  # or use your favorite editor
```

### 2. Start Application

**Windows:**
```bash
scripts\docker-start.bat
```

**Linux/Mac:**
```bash
chmod +x scripts/docker-start.sh
./scripts/docker-start.sh
```

### 3. Access Application

- Frontend: http://localhost:3001
- Backend API: http://localhost:3000
- Health Check: http://localhost:3000/health

## Production Deployment

### 1. Build for Production

```bash
docker-compose build
```

### 2. Deploy

**Windows:**
```bash
scripts\deploy.bat production
```

**Linux/Mac:**
```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh production
```

### 3. SSL Configuration

For production with HTTPS:

1. Place SSL certificates in `nginx/ssl/`:
   - `cert.pem` - SSL certificate
   - `key.pem` - Private key

2. Update `nginx/nginx.conf` with your domain name

3. Start with production nginx:
```bash
docker-compose -f docker-compose.yml up -d
```

## Docker Commands

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Stop Services
```bash
docker-compose down
```

### Remove Everything (including volumes)
```bash
docker-compose down -v
```

### Restart Service
```bash
docker-compose restart backend
docker-compose restart frontend
```

### Execute Commands in Container
```bash
# Backend shell
docker-compose exec backend sh

# Run tests
docker-compose exec backend npm test

# Database migrations (if applicable)
docker-compose exec backend npm run migrate
```

## Monitoring

### Setup Monitoring Stack
```bash
./scripts/setup-monitoring.sh
```

Access:
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3002 (admin/admin)

## Backup

### Backup Pinecone Data
```bash
./scripts/backup.sh
```

Backups are stored in `./backups/` directory.

## Troubleshooting

### Container Won't Start
```bash
# Check logs
docker-compose logs backend

# Rebuild without cache
docker-compose build --no-cache
```

### Port Already in Use
```bash
# Find process using port
lsof -i :3000  # Linux/Mac
netstat -ano | findstr :3000  # Windows

# Change port in docker-compose.yml
```

### Database Connection Issues
- Ensure DATABASE_URL is correct in .env
- Check network connectivity between containers

### Memory Issues
Increase Docker Desktop memory allocation:
- Docker Desktop → Settings → Resources → Memory

## Environment Variables

Critical variables that must be set:

```env
# Required
PINECONE_API_KEY=
OPENAI_API_KEY=
POLYGON_API_KEY=

# Optional but recommended
SLACK_BOT_TOKEN=
EMERGENCY_AUTH_CODE=

# Trading Configuration
POSITION_SIZE_USD=100
CHECK_INTERVAL_MS=5000
```

## Security Notes

1. **Never commit .env files** - Add to .gitignore
2. **Use secrets management** in production (AWS Secrets Manager, etc.)
3. **Enable rate limiting** in nginx configuration
4. **Regularly update dependencies** for security patches
5. **Monitor logs** for suspicious activity

## Performance Tuning

### Backend
- Adjust `CHECK_INTERVAL_MS` for monitoring frequency
- Configure `MAX_RETRIES` for API calls
- Set appropriate `LOG_LEVEL` (info/warn/error)

### Frontend
- Enable CDN for static assets
- Configure nginx caching headers
- Use production React build

### Database (if using)
- Configure connection pooling
- Set appropriate indexes
- Regular vacuum/analyze

## Scaling

For high availability:

1. **Load Balancing**: Use nginx upstream configuration
2. **Database Replication**: Setup read replicas
3. **Redis Cache**: Add for session/data caching
4. **Container Orchestration**: Consider Kubernetes for large deployments 