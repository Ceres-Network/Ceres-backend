import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { policies, oracleReadings, payouts } from '@ceres/shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { validateQuery, validateParams } from '../middleware/validate';
import { API_CONFIG, STROOPS_PER_USDC } from '@ceres/shared/constants';
import { PolicyStatusSchema } from '@ceres/shared/types';

const router: RouterType = Router();

const listPoliciesSchema = z.object({
  farmer: z.string().optional(),
  status: PolicyStatusSchema.optional(),
  geohash: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(API_CONFIG.MAX_PAGE_SIZE).default(API_CONFIG.DEFAULT_PAGE_SIZE),
});

router.get('/', validateQuery(listPoliciesSchema), async (req, res, next) => {
  try {
    const { farmer, status, geohash, page, limit } = req.query as unknown as z.infer<typeof listPoliciesSchema>;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (farmer) conditions.push(eq(policies.farmer, farmer));
    if (status) conditions.push(eq(policies.status, status));
    if (geohash) conditions.push(eq(policies.farmGeohash, geohash));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db
      .select()
      .from(policies)
      .where(whereClause)
      .orderBy(desc(policies.registeredAt))
      .limit(limit)
      .offset(offset);

    const total = await db
      .select({ count: sql<number>`count(*)` })
      .from(policies)
      .where(whereClause);

    res.json({
      data: results.map(p => ({
        ...p,
        coverageAmountUsdc: (Number(p.coverageAmount) / Number(STROOPS_PER_USDC)).toFixed(2),
        coverageAmountStroops: p.coverageAmount.toString(),
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

const policyIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

router.get('/:id', validateParams(policyIdSchema), async (req, res, next) => {
  try {
    const { id } = req.params as unknown as z.infer<typeof policyIdSchema>;

    const policy = await db
      .select()
      .from(policies)
      .where(eq(policies.policyId, id))
      .limit(1);

    if (policy.length === 0) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    const policyData = policy[0];

    // Get latest oracle readings for this farm's geo-cell
    const latestReadings = await db
      .select()
      .from(oracleReadings)
      .where(eq(oracleReadings.geohash, policyData.farmGeohash))
      .orderBy(desc(oracleReadings.observedAt))
      .limit(10);

    // Get payout record if triggered
    let payoutRecord = null;
    if (policyData.status === 'triggered') {
      const payout = await db
        .select()
        .from(payouts)
        .where(eq(payouts.policyId, id))
        .limit(1);

      if (payout.length > 0) {
        payoutRecord = {
          ...payout[0],
          amountUsdc: (Number(payout[0].amount) / Number(STROOPS_PER_USDC)).toFixed(2),
          amountStroops: payout[0].amount.toString(),
        };
      }
    }

    // Calculate days remaining
    const now = new Date();
    const seasonEnd = new Date(policyData.seasonEnd);
    const daysRemaining = Math.max(0, Math.ceil((seasonEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    res.json({
      ...policyData,
      coverageAmountUsdc: (Number(policyData.coverageAmount) / Number(STROOPS_PER_USDC)).toFixed(2),
      coverageAmountStroops: policyData.coverageAmount.toString(),
      daysRemaining,
      latestReadings,
      payout: payoutRecord,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
