import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChirpsFetcher } from '../fetchers/chirps';

describe('ChirpsFetcher', () => {
  let fetcher: ChirpsFetcher;

  beforeEach(() => {
    fetcher = new ChirpsFetcher();
    vi.clearAllMocks();
  });

  it('should have correct reading type', () => {
    expect(fetcher.readingType).toBe('rainfall');
  });

  it('should convert rainfall mm to fixed-point integer', async () => {
    const mockResponse = {
      data: [{ value: 41.25 }],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await fetcher.fetchForCell('u4pruyd');
    
    // 41.25 mm × 100 = 4125
    expect(result).toBe(4125);
  });

  it('should handle zero rainfall', async () => {
    const mockResponse = {
      data: [{ value: 0 }],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await fetcher.fetchForCell('u4pruyd');
    expect(result).toBe(0);
  });

  it('should throw error on API failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    await expect(fetcher.fetchForCell('u4pruyd')).rejects.toThrow('CHIRPS API error');
  });

  it('should throw error when no data returned', async () => {
    const mockResponse = {
      data: [],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    await expect(fetcher.fetchForCell('u4pruyd')).rejects.toThrow('No rainfall data');
  });
});
