import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SoilMoistureFetcher } from '../fetchers/soil';

describe('SoilMoistureFetcher', () => {
  let fetcher: SoilMoistureFetcher;

  beforeEach(() => {
    fetcher = new SoilMoistureFetcher();
    vi.clearAllMocks();
  });

  it('should have correct reading type', () => {
    expect(fetcher.readingType).toBe('soil_moisture');
  });

  it('should convert soil moisture to fixed-point integer', async () => {
    const mockResponse = {
      hourly: {
        time: ['2024-01-01T00:00', '2024-01-01T01:00', '2024-01-01T02:00'],
        soil_moisture_0_to_1cm: [0.25, 0.30, 0.28],
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await fetcher.fetchForCell('u4pruyd');
    
    // Latest value: 0.28 × 100 = 28
    expect(result).toBe(28);
  });

  it('should handle zero soil moisture', async () => {
    const mockResponse = {
      hourly: {
        time: ['2024-01-01T00:00'],
        soil_moisture_0_to_1cm: [0],
      },
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
      status: 503,
      statusText: 'Service Unavailable',
    });

    await expect(fetcher.fetchForCell('u4pruyd')).rejects.toThrow('Open-Meteo API error');
  });

  it('should throw error when no data returned', async () => {
    const mockResponse = {
      hourly: {
        time: [],
        soil_moisture_0_to_1cm: [],
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    await expect(fetcher.fetchForCell('u4pruyd')).rejects.toThrow('No soil moisture data');
  });
});
