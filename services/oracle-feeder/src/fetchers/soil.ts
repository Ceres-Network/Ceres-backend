import type { WeatherFetcher, ReadingType } from '@ceres/shared/types';

/**
 * TODO: Implement Open-Meteo soil moisture data fetcher
 * 
 * Requirements:
 * - Fetch soil moisture (0-1cm depth) from Open-Meteo API
 * - Convert geohash to lat/lng coordinates
 * - Get latest hourly value
 * - Convert soil moisture (m³/m³) to fixed-point integer (× 100)
 * 
 * API Documentation: https://open-meteo.com/en/docs
 * 
 * @see https://github.com/ceres-network/ceres-backend/issues/XX
 */
export class SoilMoistureFetcher implements WeatherFetcher {
  public readonly readingType: ReadingType = 'soil_moisture';

  async fetchForCell(geohash: string): Promise<number> {
    // TODO: Implement Open-Meteo API integration
    throw new Error('SoilMoistureFetcher not implemented yet');
  }
}
