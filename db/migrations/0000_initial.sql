-- Initial migration for Ceres Network backend
-- Generated from schema.ts

-- Policies table
CREATE TABLE IF NOT EXISTS policies (
  policy_id BIGINT PRIMARY KEY,
  farmer VARCHAR(56) NOT NULL,
  farm_geohash VARCHAR(12) NOT NULL,
  crop_type VARCHAR(64) NOT NULL,
  season_start TIMESTAMP NOT NULL,
  season_end TIMESTAMP NOT NULL,
  coverage_amount BIGINT NOT NULL,
  rainfall_threshold BIGINT NOT NULL,
  ndvi_baseline BIGINT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  registered_ledger BIGINT NOT NULL,
  registered_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS policies_farmer_idx ON policies(farmer);
CREATE INDEX IF NOT EXISTS policies_geohash_idx ON policies(farm_geohash);
CREATE INDEX IF NOT EXISTS policies_status_idx ON policies(status);

-- Pool events table
CREATE TABLE IF NOT EXISTS pool_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(16) NOT NULL,
  provider VARCHAR(56),
  amount BIGINT NOT NULL,
  shares BIGINT,
  policy_id BIGINT,
  ledger BIGINT NOT NULL,
  tx_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS pool_events_type_idx ON pool_events(event_type);
CREATE INDEX IF NOT EXISTS pool_events_provider_idx ON pool_events(provider);

-- Oracle readings table
CREATE TABLE IF NOT EXISTS oracle_readings (
  id SERIAL PRIMARY KEY,
  oracle_node VARCHAR(56) NOT NULL,
  geohash VARCHAR(12) NOT NULL,
  reading_type VARCHAR(16) NOT NULL,
  value BIGINT NOT NULL,
  observed_at TIMESTAMP NOT NULL,
  ledger BIGINT NOT NULL,
  tx_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS oracle_readings_geohash_type_idx ON oracle_readings(geohash, reading_type);
CREATE INDEX IF NOT EXISTS oracle_readings_observed_at_idx ON oracle_readings(observed_at);

-- Oracle submissions table
CREATE TABLE IF NOT EXISTS oracle_submissions (
  id SERIAL PRIMARY KEY,
  geohash VARCHAR(12) NOT NULL,
  reading_type VARCHAR(16) NOT NULL,
  value BIGINT NOT NULL,
  raw_value DOUBLE PRECISION NOT NULL,
  data_source VARCHAR(32) NOT NULL,
  status VARCHAR(16) NOT NULL,
  tx_hash VARCHAR(64),
  error_message TEXT,
  attempted_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS oracle_submissions_geohash_type_attempted_idx ON oracle_submissions(geohash, reading_type, attempted_at);

-- Payouts table
CREATE TABLE IF NOT EXISTS payouts (
  id SERIAL PRIMARY KEY,
  policy_id BIGINT NOT NULL,
  farmer VARCHAR(56) NOT NULL,
  amount BIGINT NOT NULL,
  trigger_type VARCHAR(16) NOT NULL,
  observed_value BIGINT NOT NULL,
  threshold_value BIGINT NOT NULL,
  ledger BIGINT NOT NULL,
  tx_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS payouts_farmer_idx ON payouts(farmer);
CREATE INDEX IF NOT EXISTS payouts_policy_id_idx ON payouts(policy_id);

-- Indexer state table
CREATE TABLE IF NOT EXISTS indexer_state (
  id SERIAL PRIMARY KEY,
  last_indexed_ledger BIGINT NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

-- Insert initial indexer state
INSERT INTO indexer_state (last_indexed_ledger, updated_at)
VALUES (0, NOW())
ON CONFLICT (id) DO NOTHING;
