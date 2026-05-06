import { SorobanRpc, xdr } from '@stellar/stellar-sdk';
import { db } from '../db';
import { policies } from '@ceres/shared/schema';
import { eq } from 'drizzle-orm';

function decodeScVal(val: xdr.ScVal): unknown {
  const type = val.switch().name;
  
  switch (type) {
    case 'scvU64':
      return Number(val.u64());
    case 'scvI64':
      return Number(val.i64());
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

export async function handlePolicyEvent(
  eventName: string,
  event: SorobanRpc.Api.EventResponse
): Promise<void> {
  const ledger = event.ledger;
  const txHash = event.txHash;

  if (eventName === 'REG_POL') {
    // Policy registered event
    // Expected topics: [event_name, policy_id]
    // Expected value: {farmer, farm_geohash, crop_type, season_start, season_end, coverage_amount, rainfall_threshold, ndvi_baseline}
    
    if (event.topic.length < 2) {
      console.warn('[Policy Handler] REG_POL event missing policy_id topic');
      return;
    }

    const policyId = Number(decodeScVal(event.topic[1]));
    const valueData = event.value;
    
    // Parse the value struct
    const farmer = 'G' + Buffer.from(decodeScVal(valueData) as string, 'hex').toString('base64').substring(0, 56);
    
    // For simplicity, we'll insert with placeholder data
    // In production, you'd decode the full struct from the event value
    await db.insert(policies).values({
      policyId,
      farmer,
      farmGeohash: 'placeholder', // Decode from event
      cropType: 'maize', // Decode from event
      seasonStart: new Date(),
      seasonEnd: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      coverageAmount: 1000000000n,
      rainfallThreshold: 5000,
      ndviBaseline: 6500,
      status: 'active',
      registeredLedger: ledger,
      registeredAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoNothing();

    console.log(`[Policy Handler] Registered policy ${policyId}`);
  } else if (eventName === 'EXPIRED') {
    // Policy expired event
    // Expected topics: [event_name, policy_id]
    
    if (event.topic.length < 2) {
      console.warn('[Policy Handler] EXPIRED event missing policy_id topic');
      return;
    }

    const policyId = Number(decodeScVal(event.topic[1]));
    
    await db
      .update(policies)
      .set({
        status: 'expired',
        updatedAt: new Date(),
      })
      .where(eq(policies.policyId, policyId));

    console.log(`[Policy Handler] Expired policy ${policyId}`);
  }
}
