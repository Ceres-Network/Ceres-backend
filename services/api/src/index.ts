import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { API_CONFIG } from '@ceres/shared/constants';
import { initDb } from './db';
import policiesRouter from './routes/policies';
import poolRouter from './routes/pool';
import oracleRouter from './routes/oracle';
import farmersRouter from './routes/farmers';
import payoutsRouter from './routes/payouts';
import healthRouter from './routes/health';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/logger';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Routes
app.use('/policies', policiesRouter);
app.use('/pool', poolRouter);
app.use('/oracle', oracleRouter);
app.use('/farmers', farmersRouter);
app.use('/payouts', payoutsRouter);
app.use('/health', healthRouter);

// Error handler
app.use(errorHandler);

let server: ReturnType<typeof app.listen> | null = null;

async function start() {
  await initDb();
  
  server = app.listen(API_CONFIG.PORT, () => {
    console.log(`[API] Server listening on port ${API_CONFIG.PORT}`);
  });
}

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`[API] Received ${signal}, shutting down gracefully...`);
  
  if (server) {
    server.close(() => {
      console.log('[API] Server closed');
      process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
      console.error('[API] Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch((error) => {
  console.error('[API] Fatal error:', error);
  process.exit(1);
});
