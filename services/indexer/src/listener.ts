import { SorobanRpc, xdr } from '@stellar/stellar-sdk';
import { STELLAR_CONFIG, CONTRACT_ADDRESSES, INDEXER_CONFIG } from '@ceres/shared/constants';
import { db } from './db';
import { indexerState } from '@ceres/shared/schema';
import { eq } from 'drizzle-orm';
import { handlePolicyEvent } from './handlers/policy';
import { handlePoolEvent } from './handlers/pool';
import { handleTriggerEvent } from './handlers/trigger';

const server = new SorobanRpc.Server(STELLAR_CONFIG.RPC_URL);
let isRunning = false;
let pollTimeout: NodeJS.Timeout | null = null;

async function getLastIndexedLedger(): Promise<number> {
  const state = await db.select().from(indexerState).limit(1);
  
  if (state.length === 0) {
    // Initialize with a reasonable starting ledger
    const latestLedger = await server.getLatestLedger();
    const startLedger = latestLedger.sequence - 1000; // Start from 1000 ledgers ago
    
    await db.insert(indexerState).values({
      lastIndexedLedger: startLedger,
      updatedAt: new Date(),
    });
    
    return startLedger;
  }
  
  return state[0].lastIndexedLedger;
}

async function setLastIndexedLedger(ledger: number): Promise<void> {
  await db
    .update(indexerState)
    .set({
      lastIndexedLedger: ledger,
      updatedAt: new Date(),
    })
    .where(eq(indexerState.id, 1));
}

async function handleEvent(event: SorobanRpc.Api.EventResponse): Promise<void> {
  try {
    const contractId = event.contractId;
    const topic = event.topic;
    
    // Decode event name from first topic
    if (topic.length === 0) return;
    
    const eventNameScVal = topic[0];
    let eventName: string;
    
    if (eventNameScVal.switch().name === 'scvSymbol') {
      eventName = eventNameScVal.sym().toString();
    } else if (eventNameScVal.switch().name === 'scvString') {
      eventName = eventNameScVal.str().toString();
    } else {
      console.warn('[Listener] Unknown event name type:', eventNameScVal.switch().name);
      return;
    }

    console.log(`[Listener] Processing event: ${eventName} from ${contractId}`);

    // Route to appropriate handler based on contract
    if (contractId === CONTRACT_ADDRESSES.POLICY) {
      await handlePolicyEvent(eventName, event);
    } else if (contractId === CONTRACT_ADDRESSES.POOL) {
      await handlePoolEvent(eventName, event);
    } else if (contractId === CONTRACT_ADDRESSES.TRIGGER) {
      await handleTriggerEvent(eventName, event);
    } else if (contractId === CONTRACT_ADDRESSES.ORACLE) {
      // Oracle events are already written by the feeder, skip
      console.log('[Listener] Skipping oracle event (handled by feeder)');
    }
  } catch (error) {
    console.error('[Listener] Error handling event:', error);
    throw error;
  }
}

async function pollEvents(): Promise<void> {
  if (!isRunning) return;

  try {
    const lastLedger = await getLastIndexedLedger();
    const latestLedger = await server.getLatestLedger();
    
    if (lastLedger >= latestLedger.sequence) {
      // Already caught up
      schedulePoll();
      return;
    }

    console.log(`[Listener] Polling ledgers ${lastLedger + 1} to ${latestLedger.sequence}`);

    const response = await server.getEvents({
      startLedger: lastLedger + 1,
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

    // Process events
    for (const event of response.events || []) {
      await handleEvent(event);
    }

    // Update last indexed ledger
    if (response.latestLedger) {
      await setLastIndexedLedger(response.latestLedger);
      console.log(`[Listener] Updated last indexed ledger to ${response.latestLedger}`);
    }

    schedulePoll();
  } catch (error) {
    console.error('[Listener] Error polling events:', error);
    
    // Check if it's a rate limit error
    if (error instanceof Error && error.message.includes('429')) {
      console.log('[Listener] Rate limited, backing off...');
      const backoffMs = INDEXER_CONFIG.BACKOFF_BASE_MS * 5;
      pollTimeout = setTimeout(pollEvents, backoffMs);
    } else {
      // Retry with exponential backoff
      const backoffMs = INDEXER_CONFIG.BACKOFF_BASE_MS * 2;
      pollTimeout = setTimeout(pollEvents, backoffMs);
    }
  }
}

function schedulePoll(): void {
  if (!isRunning) return;
  pollTimeout = setTimeout(pollEvents, INDEXER_CONFIG.POLL_INTERVAL_MS);
}

export async function startListener(): Promise<void> {
  if (isRunning) {
    console.warn('[Listener] Already running');
    return;
  }

  isRunning = true;
  console.log('[Listener] Starting event polling...');
  await pollEvents();
}

export async function stopListener(): Promise<void> {
  console.log('[Listener] Stopping event polling...');
  isRunning = false;
  
  if (pollTimeout) {
    clearTimeout(pollTimeout);
    pollTimeout = null;
  }
  
  // Wait for any in-flight operations to complete
  await new Promise(resolve => setTimeout(resolve, 2000));
}
