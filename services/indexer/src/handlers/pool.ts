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
    case 'scvAddress': {
      const addr = val.address();
      if (addr.switch().name === 'scAddressTypeAccount') {
        return addr.accountId().ed25519().toString('hex');
      }
      return addr.contractId().toString('hex');
    }
    case 'scvMap': {
      const map: Record<string, unknown> = {};
      const entries = val.map() || [];
      for (const entry of entries) {
        const key = decodeScVal(entry.key());
        const value = decodeScVal(entry.val());
        if (typeof key === 'string') {
          map[key] = value;
        }
      }
      return map;
    }
    case 'scvVec': {
      const vec = val.vec() || [];
      return vec.map(v => decodeScVal(v));
    }
    default:
      return null;
  }
}

async function decodeAddress(scVal: xdr.ScVal): Promise<string> {
  if (scVal.switch().name === 'scvAddress') {
    const addr = scVal.address();
    if (addr.switch().name === 'scAddressTypeAccount') {
      const publicKey = addr.accountId().ed25519();
      const { StrKey } = await import('@stellar/stellar-sdk');
      return StrKey.encodeEd25519PublicKey(publicKey);
    }
  }
  throw new Error('Invalid address format');
}

export async function handlePoolEvent(
  eventName: string,
  event: SorobanRpc.Api.EventResponse
): Promise<void> {
  // Extract ledger number from event
  const ledger = event.ledger;
  // Extract tx hash from event ID (format: "ledger-txIndex-eventIndex")
  const txHash = event.id.split('-')[0] + '-' + event.id.split('-')[1];

  if (eventName === 'DEPOSIT') {
    // Deposit event
    // Expected topics: [event_name, provider]
    // Expected value: {amount, shares} or just amount
    
    if (event.topic.length < 2) {
      console.warn('[Pool Handler] DEPOSIT event missing provider topic');
      return;
    }

    let provider: string;
    try {
      provider = await decodeAddress(event.topic[1]);
    } catch (error) {
      console.error('[Pool Handler] Failed to decode provider address:', error);
      return;
    }

    const valueData = decodeScVal(event.value);
    let amount: bigint;
    let shares: bigint | null = null;

    if (typeof valueData === 'object' && valueData !== null) {
      const data = valueData as Record<string, unknown>;
      amount = typeof data.amount === 'bigint' ? data.amount : BigInt((data.amount as number) || 0);
      shares = data.shares ? (typeof data.shares === 'bigint' ? data.shares : BigInt(data.shares as number)) : null;
    } else if (typeof valueData === 'bigint') {
      amount = valueData;
    } else {
      amount = BigInt((valueData as number) || 0);
    }

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

    let provider: string;
    try {
      provider = await decodeAddress(event.topic[1]);
    } catch (error) {
      console.error('[Pool Handler] Failed to decode provider address:', error);
      return;
    }

    const valueData = decodeScVal(event.value);
    let amount: bigint;
    let shares: bigint | null = null;

    if (typeof valueData === 'object' && valueData !== null) {
      const data = valueData as Record<string, unknown>;
      amount = typeof data.amount === 'bigint' ? data.amount : BigInt((data.amount as number) || 0);
      shares = data.shares ? (typeof data.shares === 'bigint' ? data.shares : BigInt(data.shares as number)) : null;
    } else if (typeof valueData === 'bigint') {
      amount = valueData;
    } else {
      amount = BigInt((valueData as number) || 0);
    }

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
    const valueData = decodeScVal(event.value);
    
    let amount: bigint;
    if (typeof valueData === 'object' && valueData !== null) {
      const data = valueData as Record<string, unknown>;
      amount = typeof data.amount === 'bigint' ? data.amount : BigInt((data.amount as number) || 0);
    } else if (typeof valueData === 'bigint') {
      amount = valueData;
    } else {
      amount = BigInt((valueData as number) || 0);
    }

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
