import { SorobanRpc } from '@stellar/stellar-sdk';
import { STELLAR_CONFIG, CONTRACT_ADDRESSES } from '@ceres/shared/constants';
import { db } from '../services/indexer/src/db';
import { handlePolicyEvent } from '../services/indexer/src/handlers/policy';
import { handlePoolEvent } from '../services/indexer/src/handlers/pool';
import { handleTriggerEvent } from '../services/indexer/src/handlers/trigger';

const server = new SorobanRpc.Server(STELLAR_CONFIG.RPC_URL);

async function backfill(fromLedger: number, toLedger: number) {
  console.log(`[Backfill] Re-indexing ledgers ${fromLedger} to ${toLedger}`);

  let currentLedger = fromLedger;
  const batchSize = 1000;

  while (currentLedger <= toLedger) {
    const endLedger = Math.min(currentLedger + batchSize - 1, toLedger);
    
    console.log(`[Backfill] Processing ledgers ${currentLedger} to ${endLedger}`);

    try {
      const response = await server.getEvents({
        startLedger: currentLedger,
        filters: [
          {
            contractIds: [
              CONTRACT_ADDRESSES.POOL,
              CONTRACT_ADDRESSES.POLICY,
              CONTRACT_ADDRESSES.ORACLE,
              CONTRACT_ADDRESSES.TRIGGER,
            ].filter(Boolean),
          },
        ],
      });

      for (const event of response.events || []) {
        const contractId = event.contractId;
        const topic = event.topic;
        
        if (topic.length === 0) continue;
        
        const eventNameScVal = topic[0];
        let eventName: string;
        
        if (eventNameScVal.switch().name === 'scvSymbol') {
          eventName = eventNameScVal.sym().toString();
        } else if (eventNameScVal.switch().name === 'scvString') {
          eventName = eventNameScVal.str().toString();
        } else {
          continue;
        }

        // Route to appropriate handler
        if (contractId === CONTRACT_ADDRESSES.POLICY) {
          await handlePolicyEvent(eventName, event);
        } else if (contractId === CONTRACT_ADDRESSES.POOL) {
          await handlePoolEvent(eventName, event);
        } else if (contractId === CONTRACT_ADDRESSES.TRIGGER) {
          await handleTriggerEvent(eventName, event);
        }
      }

      currentLedger = endLedger + 1;
    } catch (error) {
      console.error(`[Backfill] Error processing ledgers ${currentLedger}-${endLedger}:`, error);
      
      // Continue with next batch
      currentLedger = endLedger + 1;
    }
  }

  console.log('[Backfill] Complete');
}

// Parse command line arguments
const args = process.argv.slice(2);
const fromLedgerArg = args.find(arg => arg.startsWith('--from-ledger='));
const toLedgerArg = args.find(arg => arg.startsWith('--to-ledger='));

if (!fromLedgerArg || !toLedgerArg) {
  console.error('Usage: npm run backfill -- --from-ledger=<number> --to-ledger=<number>');
  process.exit(1);
}

const fromLedger = parseInt(fromLedgerArg.split('=')[1], 10);
const toLedger = parseInt(toLedgerArg.split('=')[1], 10);

if (isNaN(fromLedger) || isNaN(toLedger) || fromLedger > toLedger) {
  console.error('Invalid ledger range');
  process.exit(1);
}

backfill(fromLedger, toLedger).catch((error) => {
  console.error('[Backfill] Fatal error:', error);
  process.exit(1);
});
