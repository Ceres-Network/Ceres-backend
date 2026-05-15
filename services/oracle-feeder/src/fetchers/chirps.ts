import type { WeatherFetcher, ReadingType } from '@ceres/shared/types';

/**
 * TODO: Implement CHIRPS rainfall data fetcher
 * 
 * Requirements:
 * - Fetch 7-day average rainfall from CHIRPS API
 * - Convert geohash to lat/lng coordinates
 * - Handle API errors and rate limits
 * - Convert rainfall (mm) to fixed-point integer (mm × 100)
 * 
 * API Documentation: https://climateserv.servirglobal.net/
 * 
 * @see https://github.com/ceres-network/ceres-backend/issues/XX
 */
export class ChirpsFetcher implements WeatherFetcher {
  public readonly readingType: ReadingType = 'rainfall';

  async fetchForCell(geohash: string): Promise<number> {
    // TODO: Implement CHIRPS API integration
    throw new Error('ChirpsFetcher not implemented yet');
  }
}
