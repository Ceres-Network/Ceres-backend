# Quickstart Guide

Get Ceres Network backend running locally in 5 minutes.

## Prerequisites

- **Node.js 20+** ([Download](https://nodejs.org/))
- **Docker Desktop** ([Download](https://www.docker.com/products/docker-desktop))
- **Git** ([Download](https://git-scm.com/))

## Step 1: Clone Repository

```bash
git clone https://github.com/ceres-network/ceres-backend.git
cd ceres-backend
```

## Step 2: Install Dependencies

```bash
npm install
```

This installs dependencies for all services using npm workspaces.

## Step 3: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```bash
# Minimum required for local development:
STELLAR_NETWORK=testnet
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
HORIZON_URL=https://horizon-testnet.stellar.org

# Get testnet XLM and create oracle keypair:
# 1. Visit https://laboratory.stellar.org/#account-creator
# 2. Click "Generate keypair"
# 3. Click "Fund with Friendbot"
# 4. Copy keys below:
ORACLE_NODE_PUBLIC_KEY=G...
ORACLE_NODE_SECRET_KEY=S...

# Contract addresses (from your deployed contracts):
POOL_CONTRACT=C...
POLICY_CONTRACT=C...
ORACLE_CONTRACT=C...
TRIGGER_CONTRACT=C...

# Database (default for local Docker):
DATABASE_URL=postgresql://ceres:password@localhost:5432/ceres_network
```

## Step 4: Start Services

```bash
docker compose up -d
```

This starts:
- PostgreSQL (port 5432)
- Redis (port 6379)
- API (port 3001)
- Indexer
- Oracle Feeder

## Step 5: Run Migrations

```bash
npm run migrate
```

This creates all database tables.

## Step 6: Verify

Check that everything is running:

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "connected",
  "indexer": {...},
  "feeder": {...}
}
```

## Step 7: Test API

```bash
# List policies
curl http://localhost:3001/policies

# Get pool stats
curl http://localhost:3001/pool/stats

# Get oracle readings
curl "http://localhost:3001/oracle/readings?geohash=u4pruyd&reading_type=rainfall"
```

## Development Mode

For active development with auto-reload:

```bash
npm run dev
```

This runs all services in watch mode. Changes to TypeScript files trigger automatic recompilation.

## View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f indexer
docker compose logs -f oracle-feeder
```

## Run Tests

```bash
npm run test
```

## Stop Services

```bash
docker compose down
```

## Troubleshooting

### Port Already in Use

If port 3001, 5432, or 6379 is already in use:

```bash
# Find process using port
lsof -i :3001

# Kill process
kill -9 <PID>
```

Or edit `docker-compose.yml` to use different ports.

### Database Connection Failed

Ensure PostgreSQL is running:

```bash
docker compose ps postgres
```

If not running:

```bash
docker compose up -d postgres
```

### Oracle Submissions Failing

Check that:
1. Oracle node has XLM balance (check on [Stellar Expert](https://stellar.expert/explorer/testnet))
2. Contract addresses are correct
3. Contracts are deployed and initialized

View submission errors:

```bash
docker compose logs oracle-feeder
```

### Indexer Not Catching Up

Check indexer logs:

```bash
docker compose logs indexer
```

Common issues:
- Invalid contract addresses
- Soroban RPC rate limiting
- No events emitted yet (if contracts just deployed)

## Next Steps

- **Deploy Contracts**: If you haven't already, deploy the Soroban contracts
- **Register a Policy**: Use the dApp or CLI to register a test policy
- **Monitor Oracle**: Watch oracle submissions in the database
- **Explore API**: Try different API endpoints
- **Read Docs**: Check out `docs/API.md` and `docs/ARCHITECTURE.md`

## Useful Commands

```bash
# Rebuild after code changes
npm run build

# Type check
npm run typecheck

# Lint
npm run lint

# Clean build artifacts
npm run clean

# Backfill events
npm run backfill -- --from-ledger=1000000 --to-ledger=1010000

# Access database
docker compose exec postgres psql -U ceres -d ceres_network
```

## Database Queries

```sql
-- View policies
SELECT * FROM policies LIMIT 10;

-- View oracle submissions
SELECT * FROM oracle_submissions ORDER BY attempted_at DESC LIMIT 10;

-- View payouts
SELECT * FROM payouts ORDER BY created_at DESC LIMIT 10;

-- Check indexer state
SELECT * FROM indexer_state;
```

## Need Help?

- **Documentation**: Check `docs/` folder
- **Issues**: [GitHub Issues](https://github.com/ceres-network/ceres-backend/issues)
- **API Reference**: `docs/API.md`
- **Architecture**: `docs/ARCHITECTURE.md`
- **Deployment**: `docs/DEPLOYMENT.md`

## What's Next?

Once you have the backend running locally:

1. **Deploy Contracts** (if not done): Deploy the Soroban contracts to testnet
2. **Register Policies**: Create test policies via the dApp or CLI
3. **Monitor Data**: Watch as the oracle feeder submits weather data
4. **Trigger Payouts**: Test the trigger logic by simulating adverse weather
5. **Build Frontend**: Connect your dApp to the REST API

Happy building! 🚀
