import { startListener, stopListener } from './listener';
import { initDb } from './db';

let isShuttingDown = false;

async function main() {
  console.log('[Indexer] Starting...');
  
  await initDb();
  
  console.log('[Indexer] Starting event listener...');
  await startListener();
  
  console.log('[Indexer] Ready');
}

// Graceful shutdown handler
async function handleShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log(`[Indexer] Received ${signal}, shutting down gracefully...`);
  
  await stopListener();
  
  console.log('[Indexer] Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

main().catch((error) => {
  console.error('[Indexer] Fatal error:', error);
  process.exit(1);
});
