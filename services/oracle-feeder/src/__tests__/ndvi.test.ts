import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NdviFetcher } from '../fetchers/ndvi';
import { NDVI_MULTIPLIER } from '@ceres/shared/constants';

describe('NdviFetcher', () => {
  let fetcher: NdviFetcher;

  beforeEach(() => {
    fetcher = new NdviFetcher();
    vi.clearAllMocks();
  });

  it('should have correct reading type', () => {
    expect(fetcher.readingType).toBe('ndvi');
  });

  it('should convert NDVI to fixed-point integer', async () => {
    const currentMonth = new Date().getMonth() + 1;
    const mockResponse = {
      properties: {
        parameter: {
          NDVI: {
            [currentMonth.toString()]: 0.65,
          },
        },
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await fetcher.fetchForCell('u4pruyd');
    
    // 0.65 × 10,000 = 6500
    expect(result).toBe(6500);
  });

  it('should handle NDVI of 1.0', async () => {
    const currentMonth = new Date().getMonth() + 1;
    const mockResponse = {
      properties: {
        parameter: {
          NDVI: {
            [currentMonth.toString()]: 1.0,
          },
        },
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await fetcher.fetchForCell('u4pruyd');
    expect(result).toBe(10000);
  });

  it('should throw error on API failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });

    await expect(fetcher.fetchForCell('u4pruyd')).rejects.toThrow('NASA POWER API error');
  });
});
