import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { policies, payouts } from '@ceres/shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { validateParams } from '../middleware/validate';
import { STROOPS_PER_USDC } from '@ceres/shared/constants';

const router = Router();

const farmerAddressSchema = z.object({
  address: z.string().length(56),
});

router.get('/:address/policies', validateParams(farmerAddressSchema), async (req, res, next) => {
  try {
    const { address } = req.params as z.infer<typeof farmerAddressSchema>;

    const farmerPolicies = await db
      .select()
      .from(policies)
      .where(eq(policies.farmer, address));

    res.json({
      data: farmerPolicies.map(p => ({
        ...p,
        coverageAmountUsdc: (Number(p.coverageAmount) / Number(STROOPS_PER_USDC)).toFixed(2),
        coverageAmountStroops: p.coverageAmount.toString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:address/stats', validateParams(farmerAddressSchema), async (req, res, next) => {
  try {
    const { address } = req.params as z.infer<typeof farmerAddressSchema>;

    const farmerPolicies = await db
      .select()
      .from(policies)
      .where(eq(policies.farmer, address));

    const activePolicies = farmerPolicies.filter(p => p.status === 'active');
    const triggeredPolicies = farmerPolicies.filter(p => p.status === 'triggered');

    const totalCoverage = farmerPolicies.reduce(
      (sum, p) => sum + p.coverageAmount,
      0n
    );

    const farmerPayouts = await db
      .select()
      .from(payouts)
      .where(eq(payouts.farmer, address));

    const totalPayouts = farmerPayouts.reduce(
      (sum, p) => sum + p.amount,
      0n
    );

    res.json({
      total_policies: farmerPolicies.length,
      active_policies: activePolicies.length,
      total_coverage_usdc: (Number(totalCoverage) / Number(STROOPS_PER_USDC)).toFixed(2),
      total_payouts_received_usdc: (Number(totalPayouts) / Number(STROOPS_PER_USDC)).toFixed(2),
      policies_triggered: triggeredPolicies.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
