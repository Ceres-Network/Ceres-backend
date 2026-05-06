import {
  Keypair,
  SorobanRpc,
  TransactionBuilder,
  Networks,
  Operation,
  Asset,
  xdr,
  Contract,
} from '@stellar/stellar-sdk';
import { ORACLE_NODE, STELLAR_CONFIG, CONTRACT_ADDRESSES } from '@ceres/shared/constants';
import type { OracleSubmissionResult, ReadingType } from '@ceres/shared/types';

const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1000;

export class OracleSubmitter {
  private keypair: Keypair;
  private server: SorobanRpc.Server;
  private networkPassphrase: string;

  constructor() {
    if (!ORACLE_NODE.SECRET_KEY) {
      throw new Error('ORACLE_NODE_SECRET_KEY environment variable is required');
    }

    this.keypair = Keypair.fromSecret(ORACLE_NODE.SECRET_KEY);
    this.server = new SorobanRpc.Server(STELLAR_CONFIG.RPC_URL);
    this.networkPassphrase = STELLAR_CONFIG.NETWORK === 'testnet' 
      ? Networks.TESTNET 
      : Networks.PUBLIC;
  }

  async submitReading(
    geohash: string,
    readingType: ReadingType,
    value: number
  ): Promise<OracleSubmissionResult> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[Submitter] Attempt ${attempt}/${MAX_RETRIES} for ${readingType} at ${geohash}`);
        
        const txHash = await this.buildAndSubmitTransaction(geohash, readingType, value);
        
        console.log(`[Submitter] Success: ${txHash}`);
        return { success: true, txHash };
      } catch (error) {
        lastError = error as Error;
        console.error(`[Submitter] Attempt ${attempt} failed:`, error);

        if (attempt < MAX_RETRIES) {
          const backoffMs = BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
          const jitter = Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, backoffMs + jitter));
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Unknown error',
    };
  }

  private async buildAndSubmitTransaction(
    geohash: string,
    readingType: ReadingType,
    value: number
  ): Promise<string> {
    // Get account details
    const account = await this.server.getAccount(this.keypair.publicKey());
    
    // Build contract invocation
    const contract = new Contract(CONTRACT_ADDRESSES.ORACLE);
    
    // Convert parameters to XDR values
    const geohashScVal = xdr.ScVal.scvString(geohash);
    const readingTypeScVal = xdr.ScVal.scvString(readingType);
    const valueScVal = xdr.ScVal.scvI128(
      new xdr.Int128Parts({
        hi: xdr.Int64.fromString('0'),
        lo: xdr.Uint64.fromString(value.toString()),
      })
    );
    const timestampScVal = xdr.ScVal.scvU64(
      xdr.Uint64.fromString(Math.floor(Date.now() / 1000).toString())
    );

    // Build transaction
    const transaction = new TransactionBuilder(account, {
      fee: '100000',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        contract.call(
          'submit_reading',
          geohashScVal,
          readingTypeScVal,
          valueScVal,
          timestampScVal
        )
      )
      .setTimeout(30)
      .build();

    // Simulate transaction
    const simulated = await this.server.simulateTransaction(transaction);
    
    if (SorobanRpc.Api.isSimulationError(simulated)) {
      throw new Error(`Simulation failed: ${simulated.error}`);
    }

    // Prepare and sign transaction
    const prepared = SorobanRpc.assembleTransaction(transaction, simulated).build();
    prepared.sign(this.keypair);

    // Submit transaction
    const response = await this.server.sendTransaction(prepared);
    
    if (response.status === 'ERROR') {
      throw new Error(`Transaction failed: ${response.errorResult?.toXDR('base64')}`);
    }

    // Wait for confirmation
    let getResponse = await this.server.getTransaction(response.hash);
    let attempts = 0;
    const maxAttempts = 20;

    while (getResponse.status === 'NOT_FOUND' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      getResponse = await this.server.getTransaction(response.hash);
      attempts++;
    }

    if (getResponse.status === 'NOT_FOUND') {
      throw new Error('Transaction not found after polling');
    }

    if (getResponse.status === 'FAILED') {
      throw new Error(`Transaction failed: ${getResponse.resultXdr?.toXDR('base64')}`);
    }

    return response.hash;
  }
}
