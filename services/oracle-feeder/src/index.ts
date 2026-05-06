import { startScheduler, runAllFeeders } from './scheduler';
import { initDb } from './db';

let isShuttingDown = false;

async function main() {
  console.log('[Oracle Feeder] Starting...');
  
  await initDb();
  
  // Run all feeders immediately on startup for active policies
  console.log('[Oracle Feeder] Running initial feed for all active cells...');
  await runAllFeeders();
  
  // Start cron scheduler
  console.log('[Oracle Feeder] Starting scheduler...');
  startScheduler();
  
  console.log('[Oracle Feeder] Ready');
}

// Graceful shutdown handler
function handleShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log(`[Oracle Feeder] Received ${signal}, shutting down gracefully...`);
  
  // Allow in-flight operations to complete
  setTimeout(() => {
    console.log('[Oracle Feeder] Shutdown complete');
    process.exit(0);
  }, 5000);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

main().catch((error) => {
  console.error('[Oracle Feeder] Fatal error:', error);
  process.exit(1);
});
