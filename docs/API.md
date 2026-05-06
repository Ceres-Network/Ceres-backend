# Ceres Network REST API Documentation

Base URL: `http://localhost:3001` (development) or your production domain

## Authentication

Most endpoints are public. Some endpoints (marked with 🔒) require an API key:

```
X-API-Key: your-api-key-here
```

## Response Format

All responses are JSON. Successful responses return data with optional pagination:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

Error responses:

```json
{
  "error": "Error message",
  "details": [...]  // Optional validation errors
}
```

## Endpoints

### Policies

#### List Policies

```
GET /policies
```

Query parameters:
- `farmer` (optional) — Filter by farmer address (56-char Stellar address)
- `status` (optional) — Filter by status: `active`, `triggered`, `expired`
- `geohash` (optional) — Filter by farm geohash
- `page` (optional, default: 1) — Page number
- `limit` (optional, default: 20, max: 100) — Results per page

Example:
```bash
curl "http://localhost:3001/policies?farmer=GTEST...&status=active&page=1&limit=20"
```

Response:
```json
{
  "data": [
    {
      "policyId": 1,
      "farmer": "GTEST...",
      "farmGeohash": "u4pruyd",
      "cropType": "maize",
      "seasonStart": "2024-01-01T00:00:00.000Z",
      "seasonEnd": "2024-04-01T00:00:00.000Z",
      "coverageAmountUsdc": "1000.00",
      "coverageAmountStroops": "10000000000",
      "rainfallThreshold": 5000,
      "ndviBaseline": 6500,
      "status": "active",
      "registeredLedger": 1000000,
      "registeredAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1
  }
}
```

#### Get Policy by ID

```
GET /policies/:id
```

Returns full policy details including:
- Latest oracle readings for the farm's geo-cell
- Payout record (if triggered)
- Days remaining in season

Example:
```bash
curl "http://localhost:3001/policies/1"
```

Response:
```json
{
  "policyId": 1,
  "farmer": "GTEST...",
  "farmGeohash": "u4pruyd",
  "cropType": "maize",
  "seasonStart": "2024-01-01T00:00:00.000Z",
  "seasonEnd": "2024-04-01T00:00:00.000Z",
  "coverageAmountUsdc": "1000.00",
  "coverageAmountStroops": "10000000000",
  "rainfallThreshold": 5000,
  "ndviBaseline": 6500,
  "status": "active",
  "daysRemaining": 45,
  "latestReadings": [
    {
      "id": 1,
      "geohash": "u4pruyd",
      "readingType": "rainfall",
      "value": 4125,
      "observedAt": "2024-01-15T00:00:00.000Z"
    }
  ],
  "payout": null
}
```

### Farmers

#### Get Farmer Policies

```
GET /farmers/:address/policies
```

Returns all policies for a specific farmer address.

Example:
```bash
curl "http://localhost:3001/farmers/GTEST.../policies"
```

#### Get Farmer Stats

```
GET /farmers/:address/stats
```

Returns aggregated statistics for a farmer.

Example:
```bash
curl "http://localhost:3001/farmers/GTEST.../stats"
```

Response:
```json
{
  "total_policies": 3,
  "active_policies": 2,
  "total_coverage_usdc": "3000.00",
  "total_payouts_received_usdc": "500.00",
  "policies_triggered": 1
}
```

### Pool

#### Get Pool Stats

```
GET /pool/stats
```

Returns current pool capital and utilization metrics.

Example:
```bash
curl "http://localhost:3001/pool/stats"
```

Response:
```json
{
  "totalCapitalUsdc": "100000.00",
  "totalCapitalStroops": "1000000000000",
  "lockedCapitalUsdc": "15000.00",
  "lockedCapitalStroops": "150000000000",
  "freeCapitalUsdc": "85000.00",
  "freeCapitalStroops": "850000000000",
  "utilisationBps": 1500,
  "lastUpdated": "2024-01-15T12:00:00.000Z"
}
```

#### List Pool Events

```
GET /pool/events
```

Query parameters:
- `type` (optional) — Filter by event type: `deposit`, `withdraw`, `payout`
- `page` (optional, default: 1)
- `limit` (optional, default: 20, max: 100)

Example:
```bash
curl "http://localhost:3001/pool/events?type=deposit&page=1&limit=20"
```

Response:
```json
{
  "data": [
    {
      "id": 1,
      "eventType": "deposit",
      "provider": "GTEST...",
      "amountUsdc": "10000.00",
      "amountStroops": "100000000000",
      "sharesStroops": "100000000000",
      "policyId": null,
      "ledger": 1000000,
      "txHash": "abc123...",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {...}
}
```

### Oracle

#### Get Oracle Readings

```
GET /oracle/readings
```

Query parameters:
- `geohash` (required) — Geo-cell identifier
- `reading_type` (required) — `rainfall`, `ndvi`, or `soil_moisture`
- `from` (optional) — Start date (ISO 8601)
- `to` (optional) — End date (ISO 8601)
- `page` (optional, default: 1)
- `limit` (optional, default: 20, max: 100)

Example:
```bash
curl "http://localhost:3001/oracle/readings?geohash=u4pruyd&reading_type=rainfall&from=2024-01-01&to=2024-01-31"
```

Response:
```json
{
  "data": [
    {
      "id": 1,
      "oracleNode": "GTEST...",
      "geohash": "u4pruyd",
      "readingType": "rainfall",
      "value": 4125,
      "observedAt": "2024-01-15T00:00:00.000Z",
      "ledger": 1000000,
      "txHash": "abc123...",
      "createdAt": "2024-01-15T00:05:00.000Z"
    }
  ],
  "pagination": {...}
}
```

#### Get Latest Reading

```
GET /oracle/readings/latest
```

Query parameters:
- `geohash` (required)
- `reading_type` (required)

Example:
```bash
curl "http://localhost:3001/oracle/readings/latest?geohash=u4pruyd&reading_type=rainfall"
```

Response:
```json
{
  "id": 1,
  "oracleNode": "GTEST...",
  "geohash": "u4pruyd",
  "readingType": "rainfall",
  "value": 4125,
  "observedAt": "2024-01-15T00:00:00.000Z",
  "ledger": 1000000,
  "txHash": "abc123...",
  "createdAt": "2024-01-15T00:05:00.000Z"
}
```

#### Get Oracle Submissions 🔒

```
GET /oracle/submissions
```

Requires API key. Returns oracle node submission history.

Query parameters:
- `status` (optional) — Filter by status: `success`, `failed`, `skipped`
- `page` (optional, default: 1)
- `limit` (optional, default: 20, max: 100)

Example:
```bash
curl -H "X-API-Key: your-key" "http://localhost:3001/oracle/submissions?status=failed"
```

Response:
```json
{
  "data": [
    {
      "id": 1,
      "geohash": "u4pruyd",
      "readingType": "rainfall",
      "value": 4125,
      "rawValue": 41.25,
      "dataSource": "CHIRPS",
      "status": "success",
      "txHash": "abc123...",
      "errorMessage": null,
      "attemptedAt": "2024-01-15T00:00:00.000Z"
    }
  ],
  "pagination": {...}
}
```

### Payouts

#### List Payouts

```
GET /payouts
```

Query parameters:
- `farmer` (optional) — Filter by farmer address
- `policy_id` (optional) — Filter by policy ID
- `page` (optional, default: 1)
- `limit` (optional, default: 20, max: 100)

Example:
```bash
curl "http://localhost:3001/payouts?farmer=GTEST..."
```

Response:
```json
{
  "data": [
    {
      "id": 1,
      "policyId": 1,
      "farmer": "GTEST...",
      "amountUsdc": "500.00",
      "amountStroops": "5000000000",
      "triggerType": "rainfall",
      "observedValue": 3800,
      "thresholdValue": 5000,
      "ledger": 1000000,
      "txHash": "abc123...",
      "createdAt": "2024-01-15T00:00:00.000Z"
    }
  ],
  "pagination": {...}
}
```

### Health

#### Health Check

```
GET /health
```

Returns service health status.

Example:
```bash
curl "http://localhost:3001/health"
```

Response:
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

## Error Codes

- `400` — Bad Request (validation error)
- `401` — Unauthorized (missing/invalid API key)
- `404` — Not Found
- `429` — Too Many Requests (rate limit exceeded)
- `500` — Internal Server Error
- `503` — Service Unavailable (database disconnected)

## Rate Limiting

Default: 100 requests per minute per IP address.

When rate limited, response includes `retryAfter` (seconds):

```json
{
  "error": "Too many requests",
  "retryAfter": 45
}
```

## Data Types

### Fixed-Point Integers

Weather values are stored as fixed-point integers:

- **Rainfall**: mm × 100 (e.g., 41.25mm → 4125)
- **NDVI**: value × 10,000 (e.g., 0.65 → 6500)
- **Soil Moisture**: value × 100 (e.g., 0.28 → 28)

### Amounts

Financial amounts are returned in two formats:

- `amountUsdc`: Human-readable string (e.g., "1000.00")
- `amountStroops`: Precise integer string (e.g., "10000000000")

1 USDC = 10,000,000 stroops

### Timestamps

All timestamps are ISO 8601 format in UTC:

```
2024-01-15T12:00:00.000Z
```

## Pagination

All list endpoints support pagination:

- `page` — Page number (1-indexed)
- `limit` — Results per page (max 100)

Response includes pagination metadata:

```json
{
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

## CORS

CORS is enabled for all origins in development. Configure for production.

## Webhooks

When a payout is triggered, the indexer can dispatch a webhook:

```json
POST ${WEBHOOK_URL}
X-Webhook-Secret: ${WEBHOOK_SECRET}

{
  "event": "payout_triggered",
  "policy_id": 42,
  "farmer": "GTEST...",
  "amount_usdc": "250.00",
  "trigger_type": "rainfall",
  "observed_value": "38.20",
  "threshold_value": "50.00",
  "tx_hash": "abc123...",
  "ledger": 1000000
}
```
