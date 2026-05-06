import { pgTable, serial, bigint, varchar, timestamp, text, doublePrecision, index } from 'drizzle-orm/pg-core';

// Policies table
export const policies = pgTable('policies', {
  policyId: bigint('policy_id', { mode: 'number' }).primaryKey(),
  farmer: varchar('farmer', { length: 56 }).notNull(),
  farmGeohash: varchar('farm_geohash', { length: 12 }).notNull(),
  cropType: varchar('crop_type', { length: 64 }).notNull(),
  seasonStart: timestamp('season_start').notNull(),
  seasonEnd: timestamp('season_end').notNull(),
  coverageAmount: bigint('coverage_amount', { mode: 'bigint' }).notNull(),
  rainfallThreshold: bigint('rainfall_threshold', { mode: 'number' }).notNull(),
  ndviBaseline: bigint('ndvi_baseline', { mode: 'number' }).notNull(),
  status: varchar('status', { length: 16 }).notNull().default('active'),
  registeredLedger: bigint('registered_ledger', { mode: 'number' }).notNull(),
  registeredAt: timestamp('registered_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
}, (table) => ({
  farmerIdx: index('policies_farmer_idx').on(table.farmer),
  geohashIdx: index('policies_geohash_idx').on(table.farmGeohash),
  statusIdx: index('policies_status_idx').on(table.status),
}));

// Pool events table
export const poolEvents = pgTable('pool_events', {
  id: serial('id').primaryKey(),
  eventType: varchar('event_type', { length: 16 }).notNull(),
  provider: varchar('provider', { length: 56 }),
  amount: bigint('amount', { mode: 'bigint' }).notNull(),
  shares: bigint('shares', { mode: 'bigint' }),
  policyId: bigint('policy_id', { mode: 'number' }),
  ledger: bigint('ledger', { mode: 'number' }).notNull(),
  txHash: varchar('tx_hash', { length: 64 }).notNull(),
  createdAt: timestamp('created_at').notNull(),
}, (table) => ({
  eventTypeIdx: index('pool_events_type_idx').on(table.eventType),
  providerIdx: index('pool_events_provider_idx').on(table.provider),
}));

// Oracle readings table (indexed from on-chain events)
export const oracleReadings = pgTable('oracle_readings', {
  id: serial('id').primaryKey(),
  oracleNode: varchar('oracle_node', { length: 56 }).notNull(),
  geohash: varchar('geohash', { length: 12 }).notNull(),
  readingType: varchar('reading_type', { length: 16 }).notNull(),
  value: bigint('value', { mode: 'number' }).notNull(),
  observedAt: timestamp('observed_at').notNull(),
  ledger: bigint('ledger', { mode: 'number' }).notNull(),
  txHash: varchar('tx_hash', { length: 64 }).notNull(),
  createdAt: timestamp('created_at').notNull(),
}, (table) => ({
  geohashTypeIdx: index('oracle_readings_geohash_type_idx').on(table.geohash, table.readingType),
  observedAtIdx: index('oracle_readings_observed_at_idx').on(table.observedAt),
}));

// Oracle submissions table (written by feeder, not indexed from chain)
export const oracleSubmissions = pgTable('oracle_submissions', {
  id: serial('id').primaryKey(),
  geohash: varchar('geohash', { length: 12 }).notNull(),
  readingType: varchar('reading_type', { length: 16 }).notNull(),
  value: bigint('value', { mode: 'number' }).notNull(),
  rawValue: doublePrecision('raw_value').notNull(),
  dataSource: varchar('data_source', { length: 32 }).notNull(),
  status: varchar('status', { length: 16 }).notNull(),
  txHash: varchar('tx_hash', { length: 64 }),
  errorMessage: text('error_message'),
  attemptedAt: timestamp('attempted_at').notNull(),
}, (table) => ({
  geohashTypeAttemptedIdx: index('oracle_submissions_geohash_type_attempted_idx').on(table.geohash, table.readingType, table.attemptedAt),
}));

// Payouts table
export const payouts = pgTable('payouts', {
  id: serial('id').primaryKey(),
  policyId: bigint('policy_id', { mode: 'number' }).notNull(),
  farmer: varchar('farmer', { length: 56 }).notNull(),
  amount: bigint('amount', { mode: 'bigint' }).notNull(),
  triggerType: varchar('trigger_type', { length: 16 }).notNull(),
  observedValue: bigint('observed_value', { mode: 'number' }).notNull(),
  thresholdValue: bigint('threshold_value', { mode: 'number' }).notNull(),
  ledger: bigint('ledger', { mode: 'number' }).notNull(),
  txHash: varchar('tx_hash', { length: 64 }).notNull(),
  createdAt: timestamp('created_at').notNull(),
}, (table) => ({
  farmerIdx: index('payouts_farmer_idx').on(table.farmer),
  policyIdIdx: index('payouts_policy_id_idx').on(table.policyId),
}));

// Indexer state table
export const indexerState = pgTable('indexer_state', {
  id: serial('id').primaryKey(),
  lastIndexedLedger: bigint('last_indexed_ledger', { mode: 'number' }).notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});
