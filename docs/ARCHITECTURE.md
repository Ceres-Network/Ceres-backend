# Ceres Network Backend Architecture

## Overview

The Ceres Network backend is a TypeScript/Node.js monorepo consisting of three microservices that work together to support the on-chain parametric crop insurance protocol.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        External Data Sources                     │
├─────────────────┬─────────────────┬─────────────────────────────┤
│  CHIRPS API     │  NASA POWER API │  Open-Meteo API             │
│  (Rainfall)     │  (NDVI)         │  (Soil Moisture)            │
└────────┬────────┴────────┬────────┴────────┬────────────────────┘
         │                 │                 │
         └─────────────────┼─────────────────┘
                           │
                           ▼
         ┌─────────────────────────────────┐
         │     Oracle Feeder Service       │
         │  - Fetches weather data         │
         │  - Converts to fixed-point      │
         │  - Signs transactions           │
         │  - Submits to oracle contract   │
         └────────────┬────────────────────┘
                      │
                      ▼
         ┌─────────────────────────────────┐
         │      Stellar/Soroban Network    │
         │  ┌───────────────────────────┐  │
         │  │  ceres-oracle contract    │  │
         │  │  ceres-policy contract    │  │
         │  │  ceres-pool contract      │  │
         │  │  ceres-trigger contract   │  │
         │  └───────────┬───────────────┘  │
         └──────────────┼──────────────────┘
                        │ Events
                        ▼
         ┌─────────────────────────────────┐
         │     Event Indexer Service       │
         │  - Polls Soroban RPC            │
         │  - Decodes contract events      │
         │  - Writes to PostgreSQL         │
         │  - Dispatches webhooks          │
         └────────────┬────────────────────┘
                      │
                      ▼
         ┌─────────────────────────────────┐
         │         PostgreSQL              │
         │  - policies                     │
         │  - pool_events                  │
         │  - oracle_readings              │
         │  - oracle_submissions           │
         │  - payouts                      │
         │  - indexer_state                │
         └────────────┬────────────────────┘
                      │
                      ▼
         ┌─────────────────────────────────┐
         │       REST API Service          │
         │  - Express.js server            │
         │  - Query indexed data           │
         │  - Pagination & filtering       │
         │  - Rate limiting                │
         └────────────┬────────────────────┘
                      │
                      ▼
         ┌─────────────────────────────────┐
         │         dApp Frontend           │
         │  - Policy dashboard             │
         │  - Weather charts               │
         │  - Payout history               │
         └─────────────────────────────────┘
```

## Service Details

### Oracle Feeder

**Purpose**: Bridge between off-chain weather data and on-chain oracle contract

**Key Components**:
- `fetchers/` — Weather API clients (CHIRPS, NASA POWER, Open-Meteo)
- `submitter.ts` — Transaction builder and signer
- `scheduler.ts` — Cron job manager
- `geo.ts` — Geohash utilities

**Data Flow**:
1. Cron triggers fetch cycle (every 6-12 hours)
2. Query database for active policy geo-cells
3. For each cell, fetch weather data from APIs
4. Convert raw values to fixed-point integers
5. Build Soroban transaction calling `oracle.submit_reading()`
6. Sign with oracle node keypair
7. Submit to Soroban RPC
8. Record submission result in `oracle_submissions` table

**Deduplication**: Skips submissions if same cell + reading type was successfully submitted in last 6 hours

### Event Indexer

**Purpose**: Index on-chain events to PostgreSQL for fast queries

**Key Components**:
- `listener.ts` — Event polling loop
- `handlers/` — Event-specific processors (policy, pool, trigger)
- `db.ts` — Database connection

**Data Flow**:
1. Poll Soroban RPC every 10 seconds for new events
2. Filter events by contract addresses
3. Decode event topics and values
4. Route to appropriate handler based on contract + event name
5. Upsert data to PostgreSQL
6. Update `indexer_state.last_indexed_ledger`
7. For `PAYOUT_TG` events, dispatch webhook

**Resumability**: On restart, resumes from `last_indexed_ledger` — no events are missed

**Rate Limiting**: Backs off with jitter on 429 responses from Soroban RPC

### REST API

**Purpose**: Serve indexed data to dApp frontend

**Key Components**:
- `routes/` — Express route handlers
- `middleware/` — Auth, validation, rate limiting, error handling
- `db.ts` — Database connection

**Endpoints**:
- `/policies` — List and filter policies
- `/farmers/:address/*` — Farmer-specific data
- `/pool/*` — Pool stats and events
- `/oracle/*` — Oracle readings and submissions
- `/payouts` — Payout history
- `/health` — Service health check

**Features**:
- Zod schema validation
- Pagination (default 20, max 100 per page)
- Optional API key auth for sensitive endpoints
- In-memory rate limiting (100 req/min per IP)
- CORS and Helmet security headers

## Database Schema

### policies
- Primary key: `policy_id`
- Indexes: `farmer`, `farm_geohash`, `status`
- Tracks all registered policies with coverage details

### pool_events
- Event log for deposits, withdrawals, and payouts
- Used to calculate pool stats (total capital, utilization)

### oracle_readings
- Indexed from on-chain oracle events
- Used for timeseries charts in dApp

### oracle_submissions
- Written by oracle feeder (not indexed from chain)
- Tracks submission attempts, success/failure, error messages

### payouts
- Triggered policy payouts with oracle values that caused trigger
- Linked to policies via `policy_id`

### indexer_state
- Single row tracking `last_indexed_ledger`
- Enables resumable indexing

## Technology Stack

- **Runtime**: Node.js 20
- **Language**: TypeScript (strict mode, no `any`)
- **Database**: PostgreSQL 16
- **ORM**: Drizzle ORM
- **API Framework**: Express.js
- **Validation**: Zod
- **Blockchain SDK**: @stellar/stellar-sdk
- **Scheduling**: node-cron
- **Testing**: Vitest
- **Build Tool**: Turborepo
- **Containerization**: Docker

## Deployment Architecture

### Development
```
docker-compose.yml
├── postgres (local)
├── redis (local)
├── api (watch mode)
├── indexer (watch mode)
└── oracle-feeder (watch mode)
```

### Production
```
Cloud Platform (Railway/Render/Fly.io)
├── Managed PostgreSQL (with backups)
├── Managed Redis (optional)
├── API (2+ replicas, load balanced)
├── Indexer (1 replica, stateful)
└── Oracle Feeder (1 replica, stateful)
```

## Security Considerations

### Oracle Node
- Keypair stored in environment variable (encrypted at rest)
- Minimal XLM balance (only for transaction fees)
- Submission history logged for audit trail

### API
- Rate limiting to prevent abuse
- API key auth for sensitive endpoints
- Input validation with Zod schemas
- CORS and security headers via Helmet

### Database
- Connection pooling via postgres.js
- Parameterized queries (no SQL injection)
- Indexes for query performance
- Regular backups

### Webhooks
- Optional secret for signature verification
- Retry logic with exponential backoff
- Timeout protection

## Monitoring & Observability

### Health Checks
- `GET /health` returns:
  - Database connectivity
  - Indexer lag (ledgers behind tip)
  - Last feeder run timestamps

### Logs
- Structured logging with timestamps
- Service name prefix (`[API]`, `[Indexer]`, `[Oracle Feeder]`)
- Error stack traces for debugging

### Metrics (Future)
- Prometheus metrics export
- Grafana dashboards
- Alerting on service failures

## Scalability

### Current Limits
- API: Horizontally scalable (stateless)
- Indexer: Single instance (stateful, sequential processing)
- Oracle Feeder: Single instance (single keypair)

### Future Improvements
- Multi-node oracle network with consensus
- Sharded indexing by contract
- Redis-backed rate limiting for distributed API
- Event streaming (Kafka/RabbitMQ) for real-time updates

## Failure Modes & Recovery

### Oracle Feeder Downtime
- Impact: No new weather data submitted
- Recovery: On restart, immediately runs all feeders for active cells
- Mitigation: Monitor submission success rate, alert on failures

### Indexer Downtime
- Impact: Database falls behind chain state
- Recovery: Resumes from `last_indexed_ledger`, catches up automatically
- Mitigation: Use backfill script for large gaps

### API Downtime
- Impact: dApp cannot query indexed data
- Recovery: Stateless, restart immediately
- Mitigation: Deploy multiple replicas with load balancer

### Database Failure
- Impact: All services fail
- Recovery: Restore from backup, re-run migrations
- Mitigation: Managed database with automated backups

## Development Workflow

1. **Local Development**: `npm run dev` (watch mode)
2. **Testing**: `npm run test` (Vitest)
3. **Type Checking**: `npm run typecheck`
4. **Linting**: `npm run lint`
5. **Building**: `npm run build` (Turborepo)
6. **Migrations**: `npm run migrate`

## CI/CD Pipeline

1. **CI** (on push/PR):
   - Install dependencies
   - Typecheck all services
   - Lint all services
   - Build all services
   - Run tests with Postgres service container

2. **CD** (on push to main):
   - Build Docker images
   - Push to GitHub Container Registry
   - Deploy to production (manual trigger)

## Future Enhancements

- [ ] GraphQL API for flexible queries
- [ ] WebSocket support for real-time updates
- [ ] Multi-oracle consensus mechanism
- [ ] Historical data archival (cold storage)
- [ ] Advanced analytics (ML-based risk scoring)
- [ ] Multi-chain support (other Stellar assets)
