import { WEATHER_API_URLS, NDVI_MULTIPLIER } from '@ceres/shared/constants';
import type { WeatherFetcher, ReadingType } from '@ceres/shared/types';
import { getGeohashCentroid } from '../geo';

interface NasaPowerResponse {
  properties: {
    parameter: {
      NDVI: Record<string, number>;
    };
  };
}

export class NdviFetcher implements WeatherFetcher {
  public readonly readingType: ReadingType = 'ndvi';

  async fetchForCell(geohash: string): Promise<number> {
    const { latitude, longitude } = getGeohashCentroid(geohash);
    
    const url = new URL(`${WEATHER_API_URLS.NASA_POWER}/temporal/climatology/point`);
    url.searchParams.set('parameters', 'NDVI');
    url.searchParams.set('community', 'AG');
    url.searchParams.set('longitude', longitude.toFixed(4));
    url.searchParams.set('latitude', latitude.toFixed(4));
    url.searchParams.set('format', 'JSON');

    try {
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`NASA POWER API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as NasaPowerResponse;
      
      if (!data.properties?.parameter?.NDVI) {
        throw new Error('No NDVI data returned from NASA POWER');
      }

      // Get current month's NDVI value
      const currentMonth = new Date().getMonth() + 1;
      const monthKey = currentMonth.toString();
      const ndviValue = data.properties.parameter.NDVI[monthKey];
      
      if (ndviValue === undefined) {
        throw new Error(`No NDVI data for month ${currentMonth}`);
      }

      // NDVI is typically 0-1, convert to fixed-point integer (× 10,000)
      const fixedPointValue = Math.round(ndviValue * NDVI_MULTIPLIER);
      
      console.log(`[NDVI] Geohash ${geohash}: ${ndviValue.toFixed(4)} → ${fixedPointValue}`);
      
      return fixedPointValue;
    } catch (error) {
      console.error(`[NDVI] Failed to fetch for ${geohash}:`, error);
      throw error;
    }
  }
}
