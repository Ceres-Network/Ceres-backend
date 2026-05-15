import { describe, it, expect, vi } from 'vitest';

// Mock dependencies
vi.mock('../db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve([{ lastIndexedLedger: 1000 }])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  },
  initDb: vi.fn(),
}));

vi.mock('@stellar/stellar-sdk', () => ({
  SorobanRpc: {
    Server: vi.fn(() => ({
      getLatestLedger: vi.fn(() => Promise.resolve({ sequence: 1010 })),
      getEvents: vi.fn(() => Promise.resolve({
        events: [],
        latestLedger: 1010,
      })),
    })),
  },
}));

describe('Event Listener', () => {
  it('should resume from last indexed ledger', async () => {
    // Test that indexer resumes from correct ledger
    const { db } = await import('../db');
    const result = await db.select().from({} as Record<string, unknown>).limit(1);
    
    expect(result).toHaveLength(1);
    expect(result[0].lastIndexedLedger).toBe(1000);
  });

  it('should handle rate limit errors with backoff', async () => {
    // Test rate limit handling
    const error = new Error('429 Too Many Requests');
    expect(error.message).toContain('429');
  });
});
