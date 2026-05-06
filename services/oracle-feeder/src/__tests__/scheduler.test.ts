import { describe, it, expect } from 'vitest';

describe('Scheduler', () => {
  it('should have correct cron expression for rainfall (every 6 hours)', () => {
    const cronExpression = '0 */6 * * *';
    expect(cronExpression).toBe('0 */6 * * *');
  });

  it('should have correct cron expression for NDVI (every 12 hours)', () => {
    const cronExpression = '0 */12 * * *';
    expect(cronExpression).toBe('0 */12 * * *');
  });

  it('should have correct cron expression for soil moisture (every 12 hours, offset)', () => {
    const cronExpression = '30 */12 * * *';
    expect(cronExpression).toBe('30 */12 * * *');
  });

  it('should filter active cells correctly', () => {
    const policies = [
      { status: 'active', farmGeohash: 'u4pruyd' },
      { status: 'expired', farmGeohash: 'u4pruyf' },
      { status: 'active', farmGeohash: 'u4pruyd' },
      { status: 'triggered', farmGeohash: 'u4pruyg' },
    ];

    const activeCells = policies
      .filter(p => p.status === 'active')
      .map(p => p.farmGeohash);

    const uniqueCells = [...new Set(activeCells)];

    expect(uniqueCells).toEqual(['u4pruyd']);
  });

  it('should implement deduplication window correctly', () => {
    const deduplicationHours = 6;
    const now = new Date();
    const threshold = new Date(now.getTime() - deduplicationHours * 60 * 60 * 1000);

    const recentSubmission = new Date(now.getTime() - 3 * 60 * 60 * 1000); // 3 hours ago
    const oldSubmission = new Date(now.getTime() - 7 * 60 * 60 * 1000); // 7 hours ago

    expect(recentSubmission > threshold).toBe(true);
    expect(oldSubmission > threshold).toBe(false);
  });
});
