import { z } from 'zod';

export type ReadingType = 'rainfall' | 'ndvi' | 'soil_moisture';
export type PolicyStatus = 'active' | 'triggered' | 'expired';
export type PoolEventType = 'deposit' | 'withdraw' | 'payout';
export type SubmissionStatus = 'success' | 'failed' | 'skipped';

export const ReadingTypeSchema = z.enum(['rainfall', 'ndvi', 'soil_moisture']);
export const PolicyStatusSchema = z.enum(['active', 'triggered', 'expired']);
export const PoolEventTypeSchema = z.enum(['deposit', 'withdraw', 'payout']);

export interface WeatherFetcher {
  fetchForCell(geohash: string): Promise<number>;
  readingType: ReadingType;
}

export interface OracleSubmissionResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

export interface GeohashCoordinates {
  latitude: number;
  longitude: number;
}

export interface PolicyRecord {
  policyId: number;
  farmer: string;
  farmGeohash: string;
  cropType: string;
  seasonStart: Date;
  seasonEnd: Date;
  coverageAmount: bigint;
  rainfallThreshold: number;
  ndviBaseline: number;
  status: PolicyStatus;
  registeredLedger: number;
  registeredAt: Date;
  updatedAt: Date;
}

export interface PayoutRecord {
  id: number;
  policyId: number;
  farmer: string;
  amount: bigint;
  triggerType: string;
  observedValue: number;
  thresholdValue: number;
  ledger: number;
  txHash: string;
  createdAt: Date;
}

export interface PoolStats {
  totalCapital: bigint;
  lockedCapital: bigint;
  freeCapital: bigint;
  utilisationBps: number;
  totalShares: bigint;
  lastUpdated: Date;
}

export interface WebhookPayload {
  event: 'payout_triggered';
  policy_id: number;
  farmer: string;
  amount_usdc: string;
  trigger_type: string;
  observed_value: string;
  threshold_value: string;
  tx_hash: string;
  ledger: number;
}
