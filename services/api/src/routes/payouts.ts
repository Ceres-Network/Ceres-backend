import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { payouts } from '@ceres/shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { validateQuery } from '../middleware/validate';
import { API_CONFIG, STROOPS_PER_USDC } from '@ceres/shared/constants';

const router = Router();

const listPayoutsSchema = z.object({
  farmer: z.string().optional(),
  policy_id: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(API_CONFIG.MAX_PAGE_SIZE).default(API_CONFIG.DEFAULT_PAGE_SIZE),
});

router.get('/', validateQuery(listPayoutsSchema), async (req, res, next) => {
  try {
    const { farmer, policy_id, page, limit } = req.query as z.infer<typeof listPayoutsSchema>;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (farmer) conditions.push(eq(payouts.farmer, farmer));
    if (policy_id) conditions.push(eq(payouts.policyId, policy_id));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db
      .select()
      .from(payouts)
      .where(whereClause)
      .orderBy(desc(payouts.createdAt))
      .limit(limit)
      .offset(offset);

    const total = await db
      .select({ count: sql<number>`count(*)` })
      .from(payouts)
      .where(whereClause);

    res.json({
      data: results.map(p => ({
        ...p,
        amountUsdc: (Number(p.amount) / Number(STROOPS_PER_USDC)).toFixed(2),
        amountStroops: p.amount.toString(),
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
