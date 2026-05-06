# Ceres Network — Backend Services

Off-chain backend services that power the Ceres Network parametric crop insurance protocol on Stellar/Soroban.

## Why This Backend Exists

The Soroban smart contracts are the source of truth for all financial state. This backend handles everything the contracts cannot do on-chain:

- **Oracle Feeder** — Fetches real weather data (rainfall, NDVI, soil moisture) from third-party APIs, formats it, and submits signed readings to the `ceres-oracle` contract on a schedule
- **Event Indexer** — Listens to Soroban contract events and writes them to Postgres for fast, filterable queries (Soroban RPC has no efficient historical event indexing)
- **REST API** — Serves the dApp with indexed data (policy history, payout records, oracle reading timeseries) and proxies weather data lookups that require protected API keys

## Architecture

```
┌─────────────────┐
│  Weather APIs   │
│  (CHIRPS, NASA, │
│   Open-Meteo)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│ Oracle Feeder   │─────▶│ Soroban Contracts│
│  (Node.js)      │      │  (on Stellar)    │
└─────────────────┘      └────────┬─────────┘
                                  │
                                  │ Events
                                  ▼
                         ┌─────────────────┐
                         │ Event Indexer   │
                         │  (Node.js)      │
                         └────────┬────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │   PostgreSQL    │
                         └────────┬────────┘
                                  │
                                  ▼
                         ┌─────────────────┐      ┌──────────┐
                         │   REST API      │─────▶│  dApp    │
                         │  (Express)      │      │ Frontend │
                         └─────────────────┘      └──────────┘
```

## Repository Structure

```
ceres-backend/
├── services/
│   ├── oracle-feeder/      # Weather data fetcher + on-chain submitter
│   ├── indexer/            # Soroban event listener + Postgres writer
│   └── api/                # Express REST API
├── packages/
│   └── shared/             # Shared types, DB schema, config
├── db/
│   └── migrations/         # Drizzle-generated SQL migrations
├── scripts/
│   ├── migrate.ts          # Run pending migrations
│   └── backfill.ts         # Re-index historical events
├── docker-compose.yml      # Local dev environment
└── .github/workflows/      # CI/CD pipelines
```

## Prerequisites

- **Node.js 20+**
- **Docker** and **Docker Compose**
- **Funded Stellar testnet account** for oracle node (get testnet XLM from [Stellar Laboratory](https://laboratory.stellar.org/#account-creator))

## Quickstart

### 1. Clone and Install

```bash
git clone https://github.com/ceres-network/ceres-backend.git
cd ceres-backend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set:

- `ORACLE_NODE_SECRET_KEY` — Your funded Stellar testnet account secret key
- `POOL_CONTRACT`, `POLICY_CONTRACT`, `ORACLE_CONTRACT`, `TRIGGER_CONTRACT` — Deployed contract addresses
- Other API keys as needed

### 3. Start Services

```bash
# Start all services (Postgres, Redis, API, Indexer, Oracle Feeder)
docker compose up -d

# Run database migrations
npm run migrate

# View logs
docker compose logs -f
```

The API will be available at `http://localhost:3001`.

### 4. Development Mode

```bash
# Run services in watch mode (auto-reload on file changes)
npm run dev
```

## Services

### Oracle Feeder

Fetches weather data and submits to the oracle contract:

- **Rainfall** (CHIRPS) — every 6 hours
- **NDVI** (NASA POWER) — every 12 hours
- **Soil Moisture** (Open-Meteo) — every 12 hours

Only fetches data for geo-cells with active policies (no wasted API calls).

**Deduplication:** Skips submissions if the same cell + reading type was successfully submitted in the last 6 hours.

### Event Indexer

Polls Soroban RPC every 10 seconds for contract events:

- `REG_POL` → Insert policy
- `EXPIRED` → Update policy status
- `DEPOSIT`, `WITHDRAW`, `PAYOUT` → Insert pool event
- `PAYOUT_TG` → Insert payout record, update policy, dispatch webhook

**Resumability:** Tracks last indexed ledger in `indexer_state` table. On restart, resumes from where it left off.

### REST API

Serves indexed data to the dApp frontend.

**Endpoints:**

- `GET /policies` — List policies (filter by farmer, status, geohash)
- `GET /policies/:id` — Get policy details with latest oracle readings
- `GET /farmers/:address/policies` — All policies for a farmer
- `GET /farmers/:address/stats` — Farmer statistics
- `GET /pool/stats` — Pool capital and utilization
- `GET /pool/events` — Pool event history
- `GET /oracle/readings` — Oracle reading timeseries
- `GET /oracle/readings/latest` — Latest reading for a geo-cell
- `GET /oracle/submissions` — Oracle node submission history (requires API key)
- `GET /health` — Service health check

## Database Schema

All tables defined in `packages/shared/src/schema.ts` using Drizzle ORM.

**Tables:**

- `policies` — Indexed policy records
- `pool_events` — Deposit, withdraw, payout events
- `oracle_readings` — On-chain oracle readings (indexed from events)
- `oracle_submissions` — Off-chain submission attempts (written by feeder)
- `payouts` — Payout records with trigger details
- `indexer_state` — Last indexed ledger sequence

## Scripts

### Run Migrations

```bash
npm run migrate
```

### Backfill Historical Events

Re-index events from a specific ledger range:

```bash
npm run backfill -- --from-ledger=1000000 --to-ledger=1010000
```

Useful after:
- Deploying new contracts
- Recovering from indexer downtime
- Fixing event handler bugs

## Registering a New Oracle Cell

To start feeding weather data for a new geohash:

1. Ensure at least one active policy exists for that geohash (the feeder queries active policies to determine which cells to fetch)
2. The feeder will automatically start fetching data for that cell on the next scheduled run
3. Check `oracle_submissions` table to verify successful submissions

## Testing

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests for a specific service
npm run test --workspace=@ceres/oracle-feeder
```

## CI/CD

**GitHub Actions workflows:**

- **`ci.yml`** — Runs on push and PR to `main`
  - Typecheck, lint, build, test all services in parallel via Turborepo
  - Uses Postgres service container for integration tests

- **`deploy.yml`** — Runs on push to `main` (after CI passes)
  - Builds Docker images for all three services
  - Pushes to GitHub Container Registry (`ghcr.io/ceres-network/*`)
  - Includes deployment step placeholder for Railway / Render / Fly.io

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `STELLAR_NETWORK` | `testnet` or `mainnet` | Yes |
| `SOROBAN_RPC_URL` | Soroban RPC endpoint | Yes |
| `HORIZON_URL` | Horizon API endpoint | Yes |
| `POOL_CONTRACT` | Pool contract address | Yes |
| `POLICY_CONTRACT` | Policy contract address | Yes |
| `ORACLE_CONTRACT` | Oracle contract address | Yes |
| `TRIGGER_CONTRACT` | Trigger contract address | Yes |
| `ORACLE_NODE_SECRET_KEY` | Oracle node Stellar secret key | Yes (feeder) |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `API_PORT` | API server port | No (default: 3001) |
| `API_KEY` | API key for protected endpoints | No |
| `WEBHOOK_URL` | Webhook URL for payout notifications | No |
| `WEBHOOK_SECRET` | Webhook secret for signature verification | No |
| `REDIS_URL` | Redis connection string | No |

## Production Deployment

### Using Docker Compose

```bash
# Build production images
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

# Start services
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Using Pre-built Images

```bash
docker pull ghcr.io/ceres-network/api:latest
docker pull ghcr.io/ceres-network/indexer:latest
docker pull ghcr.io/ceres-network/oracle-feeder:latest
```

### Deployment Platforms

The services are designed to run on:

- **Railway** — Monorepo-friendly, auto-deploys from GitHub
- **Render** — Docker-based deployments with managed Postgres
- **Fly.io** — Global edge deployment with persistent volumes
- **AWS ECS / GCP Cloud Run** — Container orchestration platforms

## Monitoring

### Health Check

```bash
curl http://localhost:3001/health
```

Returns:
- Database connectivity status
- Indexer lag (ledgers behind tip)
- Last feeder run timestamps for each reading type

### Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f indexer
docker compose logs -f oracle-feeder
```

## Troubleshooting

### Indexer is lagging behind

Check `GET /health` for indexer lag. If lag is high:

1. Check Soroban RPC rate limits
2. Verify database performance
3. Check for errors in indexer logs

### Oracle submissions failing

Check `oracle_submissions` table for error messages:

```sql
SELECT * FROM oracle_submissions WHERE status = 'failed' ORDER BY attempted_at DESC LIMIT 10;
```

Common issues:
- Insufficient XLM balance for transaction fees
- Invalid oracle node keypair
- Weather API rate limits or downtime

### Missing events in database

Run backfill script to re-index:

```bash
npm run backfill -- --from-ledger=<start> --to-ledger=<end>
```

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.

## Links

- [Ceres Network Contracts](https://github.com/ceres-network/ceres-contracts)
- [Ceres Network dApp](https://github.com/ceres-network/ceres-dapp)
- [Stellar Documentation](https://developers.stellar.org/)
- [Soroban Documentation](https://soroban.stellar.org/)
