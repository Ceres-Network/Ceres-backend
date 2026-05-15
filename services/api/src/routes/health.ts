import { Router, type Router as RouterType } from 'express';

const router: RouterType = Router();

/**
 * TODO: Implement health check endpoint
 * 
 * Requirements:
 * - Check database connectivity
 * - Get indexer lag (current ledger - last indexed ledger)
 * - Get last feeder run timestamps for each reading type
 * - Return 503 if database is disconnected
 * - Return 200 with health status if all checks pass
 * 
 * Response format:
 * {
 *   status: 'healthy' | 'unhealthy',
 *   database: 'connected' | 'disconnected',
 *   indexer: {
 *     lastIndexedLedger: number,
 *     currentLedger: number,
 *     lag: number
 *   },
 *   feeder: {
 *     lastRainfallRun: Date | null,
 *     lastNdviRun: Date | null,
 *     lastSoilMoistureRun: Date | null
 *   }
 * }
 * 
 * @see https://github.com/ceres-network/ceres-backend/issues/XX
 */

router.get('/', async (req, res, _next) => {
  // TODO: Implement health check
  res.status(501).json({ error: 'Not implemented yet' });
});

export default router;
