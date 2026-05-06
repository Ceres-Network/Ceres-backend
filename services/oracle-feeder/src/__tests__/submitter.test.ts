import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OracleSubmitter } from '../submitter';

// Mock Stellar SDK
vi.mock('@stellar/stellar-sdk', () => ({
  Keypair: {
    fromSecret: vi.fn(() => ({
      publicKey: () => 'GTEST...',
    })),
  },
  SorobanRpc: {
    Server: vi.fn(() => ({
      getAccount: vi.fn(),
      simulateTransaction: vi.fn(),
      sendTransaction: vi.fn(),
      getTransaction: vi.fn(),
    })),
    assembleTransaction: vi.fn(),
  },
  Networks: {
    TESTNET: 'Test SDF Network ; September 2015',
    PUBLIC: 'Public Global Stellar Network ; September 2015',
  },
  TransactionBuilder: vi.fn(),
  Contract: vi.fn(),
  xdr: {
    ScVal: {
      scvString: vi.fn(),
      scvI128: vi.fn(),
      scvU64: vi.fn(),
    },
    Int128Parts: vi.fn(),
    Int64: {
      fromString: vi.fn(),
    },
    Uint64: {
      fromString: vi.fn(),
    },
  },
}));

describe('OracleSubmitter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ORACLE_NODE_SECRET_KEY = 'STEST...';
  });

  it('should throw error if secret key not provided', () => {
    delete process.env.ORACLE_NODE_SECRET_KEY;
    expect(() => new OracleSubmitter()).toThrow('ORACLE_NODE_SECRET_KEY');
  });

  it('should retry on failure with exponential backoff', async () => {
    const submitter = new OracleSubmitter();
    
    // Mock implementation that fails twice then succeeds
    let attempts = 0;
    vi.spyOn(submitter as any, 'buildAndSubmitTransaction').mockImplementation(async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Network error');
      }
      return 'tx_hash_123';
    });

    const result = await submitter.submitReading('u4pruyd', 'rainfall', 4125);
    
    expect(result.success).toBe(true);
    expect(result.txHash).toBe('tx_hash_123');
    expect(attempts).toBe(3);
  });

  it('should return failure after max retries', async () => {
    const submitter = new OracleSubmitter();
    
    vi.spyOn(submitter as any, 'buildAndSubmitTransaction').mockRejectedValue(
      new Error('Persistent error')
    );

    const result = await submitter.submitReading('u4pruyd', 'rainfall', 4125);
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Persistent error');
  });
});
