import { WEATHER_API_URLS, RAINFALL_MULTIPLIER } from '@ceres/shared/constants';
import type { WeatherFetcher, ReadingType } from '@ceres/shared/types';
import { getGeohashCentroid } from '../geo';

interface ChirpsResponse {
  data: Array<{
    value: number;
  }>;
}

export class ChirpsFetcher implements WeatherFetcher {
  public readonly readingType: ReadingType = 'rainfall';

  async fetchForCell(geohash: string): Promise<number> {
    const { latitude, longitude } = getGeohashCentroid(geohash);
    
    // Fetch last 7 days of rainfall data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    const url = new URL(`${WEATHER_API_URLS.CHIRPS}/chirps`);
    url.searchParams.set('begintime', startDate.toISOString().split('T')[0]);
    url.searchParams.set('endtime', endDate.toISOString().split('T')[0]);
    url.searchParams.set('geometry', `[${longitude},${latitude}]`);
    url.searchParams.set('operationtype', 'Average');
    url.searchParams.set('intervaltype', '0');

    try {
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`CHIRPS API error: ${response.status} ${response.statusText}`);
      }

      const data: ChirpsResponse = await response.json();
      
      if (!data.data || data.data.length === 0) {
        throw new Error('No rainfall data returned from CHIRPS');
      }

      // Get average rainfall in mm
      const rainfallMm = data.data[0].value;
      
      // Convert to fixed-point integer (mm × 100)
      const fixedPointValue = Math.round(rainfallMm * RAINFALL_MULTIPLIER);
      
      console.log(`[CHIRPS] Geohash ${geohash}: ${rainfallMm}mm → ${fixedPointValue}`);
      
      return fixedPointValue;
    } catch (error) {
      console.error(`[CHIRPS] Failed to fetch for ${geohash}:`, error);
      throw error;
    }
  }
}
