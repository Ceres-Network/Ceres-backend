import type { WeatherFetcher, ReadingType } from '@ceres/shared/types';

/**
 * TODO: Implement NASA POWER NDVI data fetcher
 * 
 * Requirements:
 * - Fetch NDVI (Normalized Difference Vegetation Index) from NASA POWER API
 * - Convert geohash to lat/lng coordinates
 * - Get current month's NDVI value
 * - Convert NDVI (0-1 range) to fixed-point integer (× 10,000)
 * 
 * API Documentation: https://power.larc.nasa.gov/docs/
 * 
 * @see https://github.com/ceres-network/ceres-backend/issues/XX
 */
export class NdviFetcher implements WeatherFetcher {
  public readonly readingType: ReadingType = 'ndvi';

  async fetchForCell(geohash: string): Promise<number> {
    // TODO: Implement NASA POWER API integration
    throw new Error('NdviFetcher not implemented yet');
  }
}
