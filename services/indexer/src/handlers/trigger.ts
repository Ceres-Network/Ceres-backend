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
    case 'scvAddress':
      return val.address().accountId().ed25519().toString('hex');
    default:
      return null;
  }
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
  const ledger = event.ledger;
  const txHash = event.txHash;

  if (eventName === 'PAYOUT_TG') {
    // Payout triggered event
    // Expected topics: [event_name, policy_id]
    // Expected value: {farmer, amount, trigger_type, observed_value, threshold_value}
    
    if (event.topic.length < 2) {
      console.warn('[Trigger Handler] PAYOUT_TG event missing policy_id topic');
      return;
    }

    const policyId = Number(decodeScVal(event.topic[1]));
    
    // Decode event value (simplified - in production, decode full struct)
    const farmer = 'GPLACEHOLDER'; // Decode from event value
    const amount = 1000000000n; // Decode from event value
    const triggerType = 'rainfall'; // Decode from event value
    const observedValue = 3800; // Decode from event value
    const thresholdValue = 5000; // Decode from event value

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

    console.log(`[Trigger Handler] Payout triggered for policy ${policyId}`);

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
