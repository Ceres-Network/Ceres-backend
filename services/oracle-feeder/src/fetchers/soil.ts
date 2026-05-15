import { WEATHER_API_URLS, SOIL_MOISTURE_MULTIPLIER } from '@ceres/shared/constants';
import type { WeatherFetcher, ReadingType } from '@ceres/shared/types';
import { getGeohashCentroid } from '../geo';

interface OpenMeteoResponse {
  hourly: {
    time: string[];
    soil_moisture_0_to_1cm: number[];
  };
}

export class SoilMoistureFetcher implements WeatherFetcher {
  public readonly readingType: ReadingType = 'soil_moisture';

  async fetchForCell(geohash: string): Promise<number> {
    const { latitude, longitude } = getGeohashCentroid(geohash);
    
    const url = new URL(`${WEATHER_API_URLS.OPEN_METEO}/forecast`);
    url.searchParams.set('latitude', latitude.toFixed(4));
    url.searchParams.set('longitude', longitude.toFixed(4));
    url.searchParams.set('hourly', 'soil_moisture_0_to_1cm');
    url.searchParams.set('forecast_days', '1');

    try {
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`Open-Meteo API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as OpenMeteoResponse;
      
      if (!data.hourly?.soil_moisture_0_to_1cm || data.hourly.soil_moisture_0_to_1cm.length === 0) {
        throw new Error('No soil moisture data returned from Open-Meteo');
      }

      // Get the most recent hourly value
      const soilMoistureValues = data.hourly.soil_moisture_0_to_1cm;
      const latestValue = soilMoistureValues[soilMoistureValues.length - 1];
      
      // Soil moisture is typically in m³/m³ (0-1 range), convert to fixed-point integer (× 100)
      const fixedPointValue = Math.round(latestValue * SOIL_MOISTURE_MULTIPLIER);
      
      console.log(`[Soil Moisture] Geohash ${geohash}: ${latestValue.toFixed(4)} → ${fixedPointValue}`);
      
      return fixedPointValue;
    } catch (error) {
      console.error(`[Soil Moisture] Failed to fetch for ${geohash}:`, error);
      throw error;
    }
  }
}
