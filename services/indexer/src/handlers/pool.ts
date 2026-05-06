import { SorobanRpc, xdr } from '@stellar/stellar-sdk';
import { db } from '../db';
import { poolEvents } from '@ceres/shared/schema';

function decodeScVal(val: xdr.ScVal): unknown {
  const type = val.switch().name;
  
  switch (type) {
    case 'scvU64':
      return Number(val.u64());
    case 'scvI64':
      return Number(val.i64());
    case 'scvU128': {
      const parts = val.u128();
      const hi = BigInt(parts.hi().toString());
      const lo = BigInt(parts.lo().toString());
      return (hi << 64n) | lo;
    }
    case 'scvI128': {
      const parts = val.i128();
      const hi = BigInt(parts.hi().toString());
      const lo = BigInt(parts.lo().toString());
      return (hi << 64n) | lo;
    }
    case 'scvU32':
      return val.u32();
    case 'scvI32':
      return val.i32();
    case 'scvString':
      return val.str().toString();
    case 'scvSymbol':
      return val.sym().toString();
    case 'scvAddress':
      return val.address().accountId().ed25519().toString('hex');
    default:
      return null;
  }
}

export async function handlePoolEvent(
  eventName: string,
  event: SorobanRpc.Api.EventResponse
): Promise<void> {
  const ledger = event.ledger;
  const txHash = event.txHash;

  if (eventName === 'DEPOSIT') {
    // Deposit event
    // Expected topics: [event_name, provider]
    // Expected value: {amount, shares}
    
    if (event.topic.length < 2) {
      console.warn('[Pool Handler] DEPOSIT event missing provider topic');
      return;
    }

    const provider = 'G' + Buffer.from(decodeScVal(event.topic[1]) as string, 'hex').toString('base64').substring(0, 56);
    const amount = decodeScVal(event.value) as bigint || 0n;
    const shares = 0n; // Decode from event value struct

    await db.insert(poolEvents).values({
      eventType: 'deposit',
      provider,
      amount,
      shares,
      policyId: null,
      ledger,
      txHash,
      createdAt: new Date(),
    });

    console.log(`[Pool Handler] Deposit: ${provider} - ${amount}`);
  } else if (eventName === 'WITHDRAW') {
    // Withdraw event
    
    if (event.topic.length < 2) {
      console.warn('[Pool Handler] WITHDRAW event missing provider topic');
      return;
    }

    const provider = 'G' + Buffer.from(decodeScVal(event.topic[1]) as string, 'hex').toString('base64').substring(0, 56);
    const amount = decodeScVal(event.value) as bigint || 0n;
    const shares = 0n; // Decode from event value struct

    await db.insert(poolEvents).values({
      eventType: 'withdraw',
      provider,
      amount,
      shares,
      policyId: null,
      ledger,
      txHash,
      createdAt: new Date(),
    });

    console.log(`[Pool Handler] Withdraw: ${provider} - ${amount}`);
  } else if (eventName === 'PAYOUT') {
    // Payout event (internal pool transfer)
    
    if (event.topic.length < 2) {
      console.warn('[Pool Handler] PAYOUT event missing policy_id topic');
      return;
    }

    const policyId = Number(decodeScVal(event.topic[1]));
    const amount = decodeScVal(event.value) as bigint || 0n;

    await db.insert(poolEvents).values({
      eventType: 'payout',
      provider: null,
      amount,
      shares: null,
      policyId,
      ledger,
      txHash,
      createdAt: new Date(),
    });

    console.log(`[Pool Handler] Payout for policy ${policyId}: ${amount}`);
  }
}
