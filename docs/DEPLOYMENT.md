# Deployment Guide

This guide covers deploying Ceres Network backend services to production.

## Prerequisites

- Funded Stellar mainnet account for oracle node
- PostgreSQL database (managed service recommended)
- Container registry access (GitHub Container Registry, Docker Hub, etc.)
- Deployment platform account (Railway, Render, Fly.io, AWS, GCP, etc.)

## Pre-Deployment Checklist

- [ ] All tests passing (`npm run test`)
- [ ] TypeScript compiles without errors (`npm run typecheck`)
- [ ] Linting passes (`npm run lint`)
- [ ] Environment variables configured
- [ ] Database migrations tested
- [ ] Oracle node keypair secured
- [ ] API keys rotated from development values
- [ ] Webhook endpoint configured (if using)
- [ ] Monitoring and alerting set up

## Environment Configuration

### Required Variables

```bash
# Stellar Network
STELLAR_NETWORK=mainnet
SOROBAN_RPC_URL=https://soroban.stellar.org
HORIZON_URL=https://horizon.stellar.org

# Contract Addresses (from deployment)
POOL_CONTRACT=C...
POLICY_CONTRACT=C...
ORACLE_CONTRACT=C...
TRIGGER_CONTRACT=C...

# Oracle Node (CRITICAL: Keep secure!)
ORACLE_NODE_PUBLIC_KEY=G...
ORACLE_NODE_SECRET_KEY=S...

# Database (use managed service)
DATABASE_URL=postgresql://user:password@host:5432/ceres_network

# API
API_PORT=3001
API_KEY=<generate-strong-random-key>

# Optional
WEBHOOK_URL=https://your-app.com/webhooks/ceres
WEBHOOK_SECRET=<generate-strong-random-key>
REDIS_URL=redis://host:6379
```

### Generating Secure Keys

```bash
# API Key (32 bytes, base64)
openssl rand -base64 32

# Webhook Secret (32 bytes, hex)
openssl rand -hex 32
```

## Deployment Options

### Option 1: Railway

Railway provides zero-config deployments from GitHub.

#### Setup

1. **Connect Repository**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login
   railway login
   
   # Link project
   railway link
   ```

2. **Create Services**
   ```bash
   # Create PostgreSQL database
   railway add --database postgresql
   
   # Create services
   railway service create api
   railway service create indexer
   railway service create oracle-feeder
   ```

3. **Configure Environment**
   ```bash
   # Set variables for each service
   railway variables set STELLAR_NETWORK=mainnet --service api
   railway variables set DATABASE_URL=$DATABASE_URL --service api
   # ... repeat for all variables
   ```

4. **Deploy**
   ```bash
   # Deploy all services
   railway up --service api
   railway up --service indexer
   railway up --service oracle-feeder
   ```

#### Railway Configuration

Create `railway.json`:
```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "services/api/Dockerfile"
  },
  "deploy": {
    "startCommand": "node dist/index.js",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Option 2: Render

Render provides managed services with automatic deployments.

#### Setup

1. **Create Blueprint** (`render.yaml`):
   ```yaml
   services:
     - type: web
       name: ceres-api
       env: docker
       dockerfilePath: ./services/api/Dockerfile
       envVars:
         - key: DATABASE_URL
           fromDatabase:
             name: ceres-db
             property: connectionString
         - key: STELLAR_NETWORK
           value: mainnet
       healthCheckPath: /health
   
     - type: worker
       name: ceres-indexer
       env: docker
       dockerfilePath: ./services/indexer/Dockerfile
       envVars:
         - key: DATABASE_URL
           fromDatabase:
             name: ceres-db
             property: connectionString
   
     - type: worker
       name: ceres-oracle-feeder
       env: docker
       dockerfilePath: ./services/oracle-feeder/Dockerfile
       envVars:
         - key: DATABASE_URL
           fromDatabase:
             name: ceres-db
             property: connectionString
   
   databases:
     - name: ceres-db
       databaseName: ceres_network
       plan: starter
   ```

2. **Deploy**
   - Push `render.yaml` to repository
   - Connect repository in Render dashboard
   - Render auto-deploys on push to main

### Option 3: Fly.io

Fly.io provides global edge deployment.

#### Setup

1. **Install Fly CLI**
   ```bash
   curl -L https://fly.io/install.sh | sh
   fly auth login
   ```

2. **Create Apps**
   ```bash
   # API
   cd services/api
   fly launch --name ceres-api --no-deploy
   
   # Indexer
   cd ../indexer
   fly launch --name ceres-indexer --no-deploy
   
   # Oracle Feeder
   cd ../oracle-feeder
   fly launch --name ceres-oracle-feeder --no-deploy
   ```

3. **Create PostgreSQL**
   ```bash
   fly postgres create --name ceres-db
   fly postgres attach ceres-db --app ceres-api
   ```

4. **Set Secrets**
   ```bash
   fly secrets set ORACLE_NODE_SECRET_KEY=S... --app ceres-oracle-feeder
   fly secrets set API_KEY=... --app ceres-api
   ```

5. **Deploy**
   ```bash
   fly deploy --app ceres-api
   fly deploy --app ceres-indexer
   fly deploy --app ceres-oracle-feeder
   ```

### Option 4: Docker Compose (VPS)

For self-hosted deployments on a VPS.

#### Setup

1. **Provision Server**
   - Ubuntu 22.04 LTS
   - 4GB RAM minimum
   - 50GB SSD
   - Docker and Docker Compose installed

2. **Clone Repository**
   ```bash
   git clone https://github.com/ceres-network/ceres-backend.git
   cd ceres-backend
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   nano .env  # Edit with production values
   ```

4. **Build and Deploy**
   ```bash
   # Build images
   docker compose -f docker-compose.yml -f docker-compose.prod.yml build
   
   # Start services
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   
   # Run migrations
   docker compose exec api npm run migrate
   ```

5. **Set Up Reverse Proxy (Nginx)**
   ```nginx
   server {
       listen 80;
       server_name api.ceres.network;
   
       location / {
           proxy_pass http://localhost:3001;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

6. **Enable SSL (Let's Encrypt)**
   ```bash
   sudo certbot --nginx -d api.ceres.network
   ```

### Option 5: Kubernetes

For large-scale deployments.

#### Setup

1. **Create Kubernetes Manifests** (`k8s/`):
   - `namespace.yaml`
   - `configmap.yaml`
   - `secrets.yaml`
   - `postgres.yaml`
   - `api-deployment.yaml`
   - `indexer-deployment.yaml`
   - `oracle-feeder-deployment.yaml`
   - `api-service.yaml`
   - `ingress.yaml`

2. **Deploy**
   ```bash
   kubectl apply -f k8s/
   ```

## Database Setup

### Run Migrations

```bash
# Using npm
npm run migrate

# Using Docker
docker compose exec api npm run migrate

# Using Railway
railway run npm run migrate

# Using Fly.io
fly ssh console --app ceres-api
npm run migrate
```

### Backfill Historical Data

If deploying after contracts are already live:

```bash
# Determine ledger range
# Start: First ledger with contract deployment
# End: Current ledger

npm run backfill -- --from-ledger=1000000 --to-ledger=1100000
```

## Post-Deployment Verification

### 1. Health Check

```bash
curl https://api.ceres.network/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "connected",
  "indexer": {
    "lastIndexedLedger": 1000000,
    "currentLedger": 1000100,
    "lag": 100
  },
  "feeder": {
    "lastRainfallRun": "2024-01-15T00:00:00.000Z",
    "lastNdviRun": "2024-01-15T00:00:00.000Z",
    "lastSoilMoistureRun": "2024-01-15T00:30:00.000Z"
  }
}
```

### 2. Test API Endpoints

```bash
# List policies
curl https://api.ceres.network/policies

# Get pool stats
curl https://api.ceres.network/pool/stats

# Get oracle readings
curl "https://api.ceres.network/oracle/readings?geohash=u4pruyd&reading_type=rainfall"
```

### 3. Verify Indexer

Check that `indexer.lag` is decreasing:

```bash
watch -n 5 'curl -s https://api.ceres.network/health | jq .indexer'
```

### 4. Verify Oracle Feeder

Check recent submissions:

```bash
curl -H "X-API-Key: your-key" \
  "https://api.ceres.network/oracle/submissions?status=success&limit=10"
```

### 5. Monitor Logs

```bash
# Docker Compose
docker compose logs -f api
docker compose logs -f indexer
docker compose logs -f oracle-feeder

# Railway
railway logs --service api

# Fly.io
fly logs --app ceres-api
```

## Monitoring & Alerting

### Set Up Monitoring

1. **Uptime Monitoring**
   - Use UptimeRobot, Pingdom, or similar
   - Monitor `GET /health` endpoint
   - Alert on 5xx errors or timeouts

2. **Log Aggregation**
   - Use Datadog, Logtail, or similar
   - Aggregate logs from all services
   - Set up alerts for error patterns

3. **Metrics**
   - Track API response times
   - Monitor database query performance
   - Track indexer lag
   - Monitor oracle submission success rate

### Key Metrics to Monitor

- **API**: Request rate, error rate, response time
- **Indexer**: Lag (ledgers behind), events processed/sec
- **Oracle Feeder**: Submission success rate, API errors
- **Database**: Connection pool usage, query time, disk usage

### Alert Thresholds

- Indexer lag > 1000 ledgers
- Oracle submission failure rate > 10%
- API error rate > 5%
- Database connection failures
- Disk usage > 80%

## Backup & Recovery

### Database Backups

```bash
# Manual backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < backup_20240115.sql
```

### Automated Backups

Most managed database services provide automated backups:

- **Railway**: Automatic daily backups
- **Render**: Automatic daily backups (paid plans)
- **Fly.io**: Use `fly-postgres-backup` extension

### Disaster Recovery Plan

1. **Database Failure**
   - Restore from latest backup
   - Run migrations: `npm run migrate`
   - Backfill missing events: `npm run backfill`

2. **Oracle Node Compromise**
   - Generate new keypair
   - Fund with XLM
   - Update `ORACLE_NODE_SECRET_KEY`
   - Restart oracle-feeder service

3. **Complete System Failure**
   - Restore database from backup
   - Redeploy all services
   - Verify health checks
   - Backfill any missing data

## Security Hardening

### 1. Secrets Management

Use platform-specific secret management:

- **Railway**: Railway secrets
- **Render**: Environment variables (encrypted)
- **Fly.io**: `fly secrets`
- **Kubernetes**: Kubernetes secrets
- **AWS**: AWS Secrets Manager
- **GCP**: Secret Manager

### 2. Network Security

- Enable firewall rules (allow only necessary ports)
- Use private networking for database connections
- Enable SSL/TLS for all external connections
- Implement DDoS protection (Cloudflare, AWS Shield)

### 3. Database Security

- Use strong passwords (32+ characters)
- Enable SSL/TLS for connections
- Restrict access by IP (if possible)
- Regular security updates
- Enable audit logging

### 4. API Security

- Rotate API keys regularly
- Implement rate limiting (Redis-backed in production)
- Use HTTPS only
- Enable CORS with specific origins
- Implement request signing for webhooks

### 5. Oracle Node Security

- Store keypair in encrypted secret store
- Use minimal XLM balance (only for fees)
- Monitor for unauthorized transactions
- Implement key rotation schedule
- Enable transaction signing alerts

## Scaling

### Horizontal Scaling

**API Service**:
- Stateless, can scale horizontally
- Add load balancer (Nginx, HAProxy, cloud LB)
- Scale to 2+ replicas

**Indexer Service**:
- Currently single instance (sequential processing)
- Future: Shard by contract or event type

**Oracle Feeder Service**:
- Currently single instance (single keypair)
- Future: Multi-node oracle network with consensus

### Vertical Scaling

Increase resources based on load:

- **API**: 1-2 CPU, 512MB-1GB RAM per replica
- **Indexer**: 0.5-1 CPU, 256MB-512MB RAM
- **Oracle Feeder**: 0.5 CPU, 256MB RAM
- **Database**: 2-4 CPU, 4-8GB RAM, SSD storage

### Database Optimization

- Add indexes for frequently queried columns
- Use connection pooling
- Enable query caching
- Archive old data to cold storage
- Use read replicas for analytics queries

## Troubleshooting

### Indexer Falling Behind

**Symptoms**: High lag in `/health` response

**Causes**:
- Soroban RPC rate limiting
- Slow database queries
- High event volume

**Solutions**:
- Increase polling interval
- Optimize database indexes
- Use backfill script to catch up
- Scale database resources

### Oracle Submissions Failing

**Symptoms**: High failure rate in `oracle_submissions` table

**Causes**:
- Insufficient XLM balance
- Weather API rate limits
- Network issues

**Solutions**:
- Fund oracle node account
- Implement API key rotation
- Add retry logic with backoff
- Monitor API status pages

### API Slow Response Times

**Symptoms**: High response times, timeouts

**Causes**:
- Slow database queries
- High request volume
- Insufficient resources

**Solutions**:
- Add database indexes
- Implement caching (Redis)
- Scale API horizontally
- Optimize queries

## Maintenance

### Regular Tasks

- **Daily**: Check health endpoint, review error logs
- **Weekly**: Review oracle submission success rate, check disk usage
- **Monthly**: Rotate API keys, review security logs, update dependencies
- **Quarterly**: Review and optimize database indexes, archive old data

### Updates

```bash
# Update dependencies
npm update

# Run tests
npm run test

# Deploy
git push origin main  # Triggers CI/CD
```

### Rollback

```bash
# Docker Compose
docker compose down
git checkout <previous-commit>
docker compose up -d

# Railway
railway rollback

# Fly.io
fly releases
fly deploy --image <previous-image>
```

## Support

For deployment issues:

1. Check logs for error messages
2. Verify environment variables
3. Test database connectivity
4. Review [GitHub Issues](https://github.com/ceres-network/ceres-backend/issues)
5. Contact maintainers

## Checklist: Production Deployment

- [ ] Environment variables configured
- [ ] Database provisioned and migrated
- [ ] Oracle node funded with XLM
- [ ] All services deployed and healthy
- [ ] Health check passing
- [ ] API endpoints responding
- [ ] Indexer catching up to current ledger
- [ ] Oracle feeder submitting successfully
- [ ] Monitoring and alerting configured
- [ ] Backups enabled
- [ ] SSL/TLS certificates installed
- [ ] Domain DNS configured
- [ ] Load balancer configured (if applicable)
- [ ] Firewall rules configured
- [ ] Documentation updated with production URLs
- [ ] Team notified of deployment
