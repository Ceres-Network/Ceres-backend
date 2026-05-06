import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { oracleReadings, oracleSubmissions } from '@ceres/shared/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { validateQuery } from '../middleware/validate';
import { requireApiKey } from '../middleware/auth';
import { API_CONFIG } from '@ceres/shared/constants';
import { ReadingTypeSchema } from '@ceres/shared/types';

const router = Router();

const readingsQuerySchema = z.object({
  geohash: z.string().min(1),
  reading_type: ReadingTypeSchema,
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(API_CONFIG.MAX_PAGE_SIZE).default(API_CONFIG.DEFAULT_PAGE_SIZE),
});

router.get('/readings', validateQuery(readingsQuerySchema), async (req, res, next) => {
  try {
    const { geohash, reading_type, from, to, page, limit } = req.query as z.infer<typeof readingsQuerySchema>;
    const offset = (page - 1) * limit;

    const conditions = [
      eq(oracleReadings.geohash, geohash),
      eq(oracleReadings.readingType, reading_type),
    ];

    if (from) conditions.push(gte(oracleReadings.observedAt, from));
    if (to) conditions.push(lte(oracleReadings.observedAt, to));

    const results = await db
      .select()
      .from(oracleReadings)
      .where(and(...conditions))
      .orderBy(desc(oracleReadings.observedAt))
      .limit(limit)
      .offset(offset);

    const total = await db
      .select({ count: sql<number>`count(*)` })
      .from(oracleReadings)
      .where(and(...conditions));

    res.json({
      data: results,
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

const latestReadingSchema = z.object({
  geohash: z.string().min(1),
  reading_type: ReadingTypeSchema,
});

router.get('/readings/latest', validateQuery(latestReadingSchema), async (req, res, next) => {
  try {
    const { geohash, reading_type } = req.query as z.infer<typeof latestReadingSchema>;

    const result = await db
      .select()
      .from(oracleReadings)
      .where(
        and(
          eq(oracleReadings.geohash, geohash),
          eq(oracleReadings.readingType, reading_type)
        )
      )
      .orderBy(desc(oracleReadings.observedAt))
      .limit(1);

    if (result.length === 0) {
      return res.status(404).json({ error: 'No readings found' });
    }

    res.json(result[0]);
  } catch (error) {
    next(error);
  }
});

const submissionsQuerySchema = z.object({
  node: z.string().optional(),
  status: z.enum(['success', 'failed', 'skipped']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(API_CONFIG.MAX_PAGE_SIZE).default(API_CONFIG.DEFAULT_PAGE_SIZE),
});

router.get('/submissions', requireApiKey, validateQuery(submissionsQuerySchema), async (req, res, next) => {
  try {
    const { node, status, page, limit } = req.query as z.infer<typeof submissionsQuerySchema>;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (status) conditions.push(eq(oracleSubmissions.status, status));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db
      .select()
      .from(oracleSubmissions)
      .where(whereClause)
      .orderBy(desc(oracleSubmissions.attemptedAt))
      .limit(limit)
      .offset(offset);

    const total = await db
      .select({ count: sql<number>`count(*)` })
      .from(oracleSubmissions)
      .where(whereClause);

    res.json({
      data: results,
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
