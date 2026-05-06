import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '@ceres/shared/schema';

const connectionString = process.env.DATABASE_URL!;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const client = postgres(connectionString);
export const db = drizzle(client, { schema });

export async function initDb() {
  try {
    await client`SELECT 1`;
    console.log('[Indexer] Database connection established');
  } catch (error) {
    console.error('[Indexer] Database connection failed:', error);
    throw error;
  }
}
