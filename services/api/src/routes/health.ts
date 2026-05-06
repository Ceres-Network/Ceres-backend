import { Router } from 'express';
import { db } from '../db';
import { indexerState, oracleSubmissions } from '@ceres/shared/schema';
import { desc, eq } from 'drizzle-orm';
import { SorobanRpc } from '@stellar/stellar-sdk';
import { STELLAR_CONFIG } from '@ceres/shared/constants';

const router = Router();
const server = new SorobanRpc.Server(STELLAR_CONFIG.RPC_URL);

router.get('/', async (req, res, next) => {
  try {
    // Check database connectivity
    const dbHealthy = await db.select().from(indexerState).limit(1)
      .then(() => true)
      .catch(() => false);

    if (!dbHealthy) {
      return res.status(503).json({
        status: 'unhealthy',
        database: 'disconnected',
      });
    }

    // Get indexer lag
    const state = await db.select().from(indexerState).limit(1);
    const latestLedger = await server.getLatestLedger();
    const indexerLag = state.length > 0 
      ? latestLedger.sequence - state[0].lastIndexedLedger 
      : null;

    // Get last feeder run timestamps
    const lastRainfallRun = await db
      .select()
      .from(oracleSubmissions)
      .where(eq(oracleSubmissions.readingType, 'rainfall'))
      .orderBy(desc(oracleSubmissions.attemptedAt))
      .limit(1);

    const lastNdviRun = await db
      .select()
      .from(oracleSubmissions)
      .where(eq(oracleSubmissions.readingType, 'ndvi'))
      .orderBy(desc(oracleSubmissions.attemptedAt))
      .limit(1);

    const lastSoilRun = await db
      .select()
      .from(oracleSubmissions)
      .where(eq(oracleSubmissions.readingType, 'soil_moisture'))
      .orderBy(desc(oracleSubmissions.attemptedAt))
      .limit(1);

    res.json({
      status: 'healthy',
      database: 'connected',
      indexer: {
        lastIndexedLedger: state[0]?.lastIndexedLedger || null,
        currentLedger: latestLedger.sequence,
        lag: indexerLag,
      },
      feeder: {
        lastRainfallRun: lastRainfallRun[0]?.attemptedAt || null,
        lastNdviRun: lastNdviRun[0]?.attemptedAt || null,
        lastSoilMoistureRun: lastSoilRun[0]?.attemptedAt || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
