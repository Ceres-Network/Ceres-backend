import { SorobanRpc, xdr } from '@stellar/stellar-sdk';
import { db } from '../db';
import { payouts, policies } from '@ceres/shared/schema';
import { eq } from 'drizzle-orm';

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

async function dispatchWebhook(payout: {
  policyId: number;
  farmer: string;
  amount: bigint;
  triggerType: string;
  observedValue: number;
  thresholdValue: number;
  txHash: string;
  ledger: number;
}): Promise<void> {
  const webhookUrl = process.env.WEBHOOK_URL;
  const webhookSecret = process.env.WEBHOOK_SECRET;

  if (!webhookUrl) {
    console.log('[Trigger Handler] No webhook URL configured, skipping dispatch');
    return;
  }

  try {
    const payload = {
      event: 'payout_triggered',
      policy_id: payout.policyId,
      farmer: payout.farmer,
      amount_usdc: (Number(payout.amount) / 10_000_000).toFixed(2),
      trigger_type: payout.triggerType,
      observed_value: (payout.observedValue / 100).toFixed(2),
      threshold_value: (payout.thresholdValue / 100).toFixed(2),
      tx_hash: payout.txHash,
      ledger: payout.ledger,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (webhookSecret) {
      headers['X-Webhook-Secret'] = webhookSecret;
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`[Trigger Handler] Webhook dispatch failed: ${response.status}`);
    } else {
      console.log(`[Trigger Handler] Webhook dispatched for policy ${payout.policyId}`);
    }
  } catch (error) {
    console.error('[Trigger Handler] Webhook dispatch error:', error);
  }
}

export async function handleTriggerEvent(
  eventName: string,
  event: SorobanRpc.Api.EventResponse
): Promise<void> {
  // Extract ledger number from event
  const ledger = event.ledger;
  // Extract tx hash from event ID (format: "ledger-txIndex-eventIndex")
  const txHash = event.id.split('-')[0] + '-' + event.id.split('-')[1];

  if (eventName === 'PAYOUT_TG') {
    // Payout triggered event
    // Expected topics: [event_name, policy_id, farmer]
    // Expected value: {amount, trigger_type, observed_value, threshold_value}
    
    if (event.topic.length < 2) {
      console.warn('[Trigger Handler] PAYOUT_TG event missing policy_id topic');
      return;
    }

    const policyId = Number(decodeScVal(event.topic[1]));
    
    // Try to get farmer from topic or fetch from policy
    let farmer: string;
    try {
      if (event.topic.length > 2) {
        farmer = await decodeAddress(event.topic[2]);
      } else {
        // Fetch farmer from policy table
        const policy = await db
          .select({ farmer: policies.farmer })
          .from(policies)
          .where(eq(policies.policyId, policyId))
          .limit(1);
        
        if (policy.length === 0) {
          console.warn(`[Trigger Handler] Policy ${policyId} not found in database`);
          return;
        }
        farmer = policy[0].farmer;
      }
    } catch (error) {
      console.error('[Trigger Handler] Failed to get farmer address:', error);
      return;
    }

    // Decode event value
    const valueData = decodeScVal(event.value);
    let amount: bigint;
    let triggerType: string;
    let observedValue: number;
    let thresholdValue: number;

    if (typeof valueData === 'object' && valueData !== null) {
      const data = valueData as Record<string, unknown>;
      amount = typeof data.amount === 'bigint' ? data.amount : BigInt((data.amount as number) || 0);
      triggerType = String(data.trigger_type || data.triggerType || 'unknown');
      observedValue = Number(data.observed_value || data.observedValue || 0);
      thresholdValue = Number(data.threshold_value || data.thresholdValue || 0);
    } else {
      // Fallback: try to get from policy
      console.warn('[Trigger Handler] Unable to decode full payout data, using defaults');
      amount = typeof valueData === 'bigint' ? valueData : BigInt((valueData as number) || 0);
      triggerType = 'unknown';
      observedValue = 0;
      thresholdValue = 0;
    }

    // Insert payout record
    await db.insert(payouts).values({
      policyId,
      farmer,
      amount,
      triggerType,
      observedValue,
      thresholdValue,
      ledger,
      txHash,
      createdAt: new Date(),
    });

    // Update policy status
    await db
      .update(policies)
      .set({
        status: 'triggered',
        updatedAt: new Date(),
      })
      .where(eq(policies.policyId, policyId));

    console.log(`[Trigger Handler] Payout triggered for policy ${policyId}: ${amount}`);

    // Dispatch webhook
    await dispatchWebhook({
      policyId,
      farmer,
      amount,
      triggerType,
      observedValue,
      thresholdValue,
      txHash,
      ledger,
    });
  }
}
