import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

async function main() {
  console.log('[Migrate] Connecting to database...');
  
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  console.log('[Migrate] Running migrations...');
  
  await migrate(db, { migrationsFolder: './db/migrations' });

  console.log('[Migrate] Migrations complete');
  
  await client.end();
}

main().catch((error) => {
  console.error('[Migrate] Error:', error);
  process.exit(1);
});
