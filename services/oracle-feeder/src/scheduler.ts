import cron from 'node-cron';
import { eq, and, gte } from 'drizzle-orm';
import { db } from './db';
import { policies, oracleSubmissions } from '@ceres/shared/schema';
import { ChirpsFetcher } from './fetchers/chirps';
import { NdviFetcher } from './fetchers/ndvi';
import { SoilMoistureFetcher } from './fetchers/soil';
import { OracleSubmitter } from './submitter';
import type { ReadingType } from '@ceres/shared/types';
import { FEEDER_INTERVALS } from '@ceres/shared/constants';

const submitter = new OracleSubmitter();

async function getActiveCells(): Promise<string[]> {
  const activePolicies = await db
    .select({ farmGeohash: policies.farmGeohash })
    .from(policies)
    .where(eq(policies.status, 'active'));

  // Get unique geohashes
  const uniqueCells = [...new Set(activePolicies.map(p => p.farmGeohash))];
  
  console.log(`[Scheduler] Found ${uniqueCells.length} active geo-cells`);
  return uniqueCells;
}

async function shouldSubmit(
  geohash: string,
  readingType: ReadingType
): Promise<boolean> {
  const deduplicationThreshold = new Date();
  deduplicationThreshold.setHours(
    deduplicationThreshold.getHours() - FEEDER_INTERVALS.DEDUPLICATION_HOURS
  );

  const recentSubmission = await db
    .select()
    .from(oracleSubmissions)
    .where(
      and(
        eq(oracleSubmissions.geohash, geohash),
        eq(oracleSubmissions.readingType, readingType),
        eq(oracleSubmissions.status, 'success'),
        gte(oracleSubmissions.attemptedAt, deduplicationThreshold)
      )
    )
    .limit(1);

  return recentSubmission.length === 0;
}

async function feedReadings(
  fetcher: { fetchForCell: (geohash: string) => Promise<number>; readingType: ReadingType },
  dataSource: string
) {
  console.log(`[Scheduler] Starting ${fetcher.readingType} feed...`);
  
  const cells = await getActiveCells();
  
  if (cells.length === 0) {
    console.log(`[Scheduler] No active cells, skipping ${fetcher.readingType} feed`);
    return;
  }

  for (const geohash of cells) {
    try {
      // Check if we should submit (deduplication)
      if (!(await shouldSubmit(geohash, fetcher.readingType))) {
        console.log(`[Scheduler] Skipping ${geohash} - recent submission exists`);
        
        await db.insert(oracleSubmissions).values({
          geohash,
          readingType: fetcher.readingType,
          value: 0,
          rawValue: 0,
          dataSource,
          status: 'skipped',
          attemptedAt: new Date(),
        });
        
        continue;
      }

      // Fetch weather data
      const rawValue = await fetcher.fetchForCell(geohash);
      
      // Submit to oracle contract
      const result = await submitter.submitReading(
        geohash,
        fetcher.readingType,
        rawValue
      );

      // Record submission
      await db.insert(oracleSubmissions).values({
        geohash,
        readingType: fetcher.readingType,
        value: rawValue,
        rawValue: rawValue / (fetcher.readingType === 'ndvi' ? 10000 : 100),
        dataSource,
        status: result.success ? 'success' : 'failed',
        txHash: result.txHash,
        errorMessage: result.error,
        attemptedAt: new Date(),
      });

      console.log(
        `[Scheduler] ${geohash} ${fetcher.readingType}: ${result.success ? 'SUCCESS' : 'FAILED'}`
      );
    } catch (error) {
      console.error(`[Scheduler] Error processing ${geohash}:`, error);
      
      // Record failed submission
      await db.insert(oracleSubmissions).values({
        geohash,
        readingType: fetcher.readingType,
        value: 0,
        rawValue: 0,
        dataSource,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        attemptedAt: new Date(),
      });
    }
  }

  console.log(`[Scheduler] Completed ${fetcher.readingType} feed`);
}

export async function feedRainfall() {
  await feedReadings(new ChirpsFetcher(), 'CHIRPS');
}

export async function feedNDVI() {
  await feedReadings(new NdviFetcher(), 'NASA_POWER');
}

export async function feedSoilMoisture() {
  await feedReadings(new SoilMoistureFetcher(), 'OPEN_METEO');
}

export async function runAllFeeders() {
  await feedRainfall();
  await feedNDVI();
  await feedSoilMoisture();
}

export function startScheduler() {
  // Run rainfall fetch every 6 hours
  cron.schedule('0 */6 * * *', () => {
    console.log('[Scheduler] Rainfall cron triggered');
    feedRainfall().catch(error => {
      console.error('[Scheduler] Rainfall feed error:', error);
    });
  });

  // Run NDVI fetch every 12 hours
  cron.schedule('0 */12 * * *', () => {
    console.log('[Scheduler] NDVI cron triggered');
    feedNDVI().catch(error => {
      console.error('[Scheduler] NDVI feed error:', error);
    });
  });

  // Run soil moisture fetch every 12 hours (offset by 30 minutes)
  cron.schedule('30 */12 * * *', () => {
    console.log('[Scheduler] Soil moisture cron triggered');
    feedSoilMoisture().catch(error => {
      console.error('[Scheduler] Soil moisture feed error:', error);
    });
  });

  console.log('[Scheduler] Cron jobs registered');
}
