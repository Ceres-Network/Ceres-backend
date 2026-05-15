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
      // Convert to Stellar G-address format
      const { StrKey } = await import('@stellar/stellar-sdk');
      return StrKey.encodeEd25519PublicKey(publicKey);
    }
  }
  throw new Error('Invalid address format');
}

export async function handlePolicyEvent(
  eventName: string,
  event: SorobanRpc.Api.EventResponse
): Promise<void> {
  // Extract ledger number from event
  const ledger = event.ledger;

  if (eventName === 'REG_POL') {
    // Policy registered event
    // Expected topics: [event_name, policy_id]
    // Expected value: Map with policy details
    
    if (event.topic.length < 2) {
      console.warn('[Policy Handler] REG_POL event missing policy_id topic');
      return;
    }

    const policyId = Number(decodeScVal(event.topic[1]));
    const valueData = decodeScVal(event.value);
    
    // Parse the value - it could be a map or struct
    let policyData: Record<string, unknown>;
    
    if (typeof valueData === 'object' && valueData !== null) {
      policyData = valueData as Record<string, unknown>;
    } else {
      console.warn('[Policy Handler] Unable to decode policy data, using defaults');
      policyData = {};
    }

    // Extract farmer address
    let farmer: string;
    try {
      if (event.topic.length > 2) {
        farmer = await decodeAddress(event.topic[2]);
      } else if (policyData.farmer) {
        farmer = String(policyData.farmer);
      } else {
        console.warn('[Policy Handler] No farmer address found, skipping');
        return;
      }
    } catch (error) {
      console.error('[Policy Handler] Failed to decode farmer address:', error);
      return;
    }

    // Extract other fields with fallbacks
    const farmGeohash = String(policyData.farm_geohash || policyData.geohash || 'unknown');
    const cropType = String(policyData.crop_type || policyData.crop || 'unknown');
    
    // Handle timestamps
    const seasonStart = policyData.season_start 
      ? new Date(Number(policyData.season_start) * 1000)
      : new Date();
    const seasonEnd = policyData.season_end
      ? new Date(Number(policyData.season_end) * 1000)
      : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    
    // Handle amounts and thresholds
    const coverageAmount = typeof policyData.coverage_amount === 'bigint'
      ? policyData.coverage_amount
      : BigInt((policyData.coverage_amount as number) || 0);
    
    const rainfallThreshold = Number(policyData.rainfall_threshold || 5000);
    const ndviBaseline = Number(policyData.ndvi_baseline || 6500);

    await db.insert(policies).values({
      policyId,
      farmer,
      farmGeohash,
      cropType,
      seasonStart,
      seasonEnd,
      coverageAmount,
      rainfallThreshold,
      ndviBaseline,
      status: 'active',
      registeredLedger: ledger,
      registeredAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoNothing();

    console.log(`[Policy Handler] Registered policy ${policyId} for farmer ${farmer}`);
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
