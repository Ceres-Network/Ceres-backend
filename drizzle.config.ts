import type { Config } from 'drizzle-kit';

export default {
  schema: './packages/shared/src/schema.ts',
  out: './db/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL || 'postgresql://ceres:password@localhost:5432/ceres_network',
  },
} satisfies Config;
