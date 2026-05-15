import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { poolEvents } from '@ceres/shared/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { validateQuery } from '../middleware/validate';
import { API_CONFIG, STROOPS_PER_USDC } from '@ceres/shared/constants';
import { PoolEventTypeSchema } from '@ceres/shared/types';

const router: RouterType = Router();

router.get('/stats', async (req, res, next) => {
  try {
    // Calculate pool stats from events
    const deposits = await db
      .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
      .from(poolEvents)
      .where(eq(poolEvents.eventType, 'deposit'));

    const withdrawals = await db
      .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
      .from(poolEvents)
      .where(eq(poolEvents.eventType, 'withdraw'));

    const poolPayouts = await db
      .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
      .from(poolEvents)
      .where(eq(poolEvents.eventType, 'payout'));

    const totalDeposits = BigInt(deposits[0].total);
    const totalWithdrawals = BigInt(withdrawals[0].total);
    const totalPayouts = BigInt(poolPayouts[0].total);

    const totalCapital = totalDeposits - totalWithdrawals - totalPayouts;
    const lockedCapital = totalPayouts; // Simplified
    const freeCapital = totalCapital - lockedCapital;
    const utilisationBps = totalCapital > 0n 
      ? Number((lockedCapital * 10000n) / totalCapital)
      : 0;

    res.json({
      totalCapitalUsdc: (Number(totalCapital) / Number(STROOPS_PER_USDC)).toFixed(2),
      totalCapitalStroops: totalCapital.toString(),
      lockedCapitalUsdc: (Number(lockedCapital) / Number(STROOPS_PER_USDC)).toFixed(2),
      lockedCapitalStroops: lockedCapital.toString(),
      freeCapitalUsdc: (Number(freeCapital) / Number(STROOPS_PER_USDC)).toFixed(2),
      freeCapitalStroops: freeCapital.toString(),
      utilisationBps,
      lastUpdated: new Date(),
    });
  } catch (error) {
    next(error);
  }
});

const listEventsSchema = z.object({
  type: PoolEventTypeSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(API_CONFIG.MAX_PAGE_SIZE).default(API_CONFIG.DEFAULT_PAGE_SIZE),
});

router.get('/events', validateQuery(listEventsSchema), async (req, res, next) => {
  try {
    const { type, page, limit } = req.query as unknown as z.infer<typeof listEventsSchema>;
    const offset = (page - 1) * limit;

    const whereClause = type ? eq(poolEvents.eventType, type) : undefined;

    const results = await db
      .select()
      .from(poolEvents)
      .where(whereClause)
      .orderBy(desc(poolEvents.createdAt))
      .limit(limit)
      .offset(offset);

    const total = await db
      .select({ count: sql<number>`count(*)` })
      .from(poolEvents)
      .where(whereClause);

    res.json({
      data: results.map(e => ({
        ...e,
        amountUsdc: (Number(e.amount) / Number(STROOPS_PER_USDC)).toFixed(2),
        amountStroops: e.amount.toString(),
        sharesStroops: e.shares?.toString() || null,
      })),
      pagination: {
        page,
        limit,
        total: Number(total[0].count),
        pages: Math.ceil(Number(total[0].count) / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
