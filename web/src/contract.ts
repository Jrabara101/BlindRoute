// Contract-side logic: providers wiring, deploy/join, and the two circuits
// (lockEscrow, releaseEscrow). Mirrors cli/src/api.ts, but with a Lace
// ConnectedAPI standing in for the CLI's own wallet-sdk-facade wallet.

import type { ConnectedAPI, Configuration } from '@midnight-ntwrk/dapp-connector-api';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js/contracts';
import { createProofProvider, type UnboundTransaction } from '@midnight-ntwrk/midnight-js/types';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { toHex, fromHex } from '@midnight-ntwrk/midnight-js/utils';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import {
  Transaction,
  type FinalizedTransaction,
  type TransactionId,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { BlindRoute, witnesses, type BlindRoutePrivateState } from '@midnight-ntwrk/blindroute-contract';
import { inMemoryPrivateStateProvider } from './in-memory-private-state-provider';
import { Buffer } from 'buffer';

const BLINDROUTE_PRIVATE_STATE_ID = 'blindroutePrivateState';

const compiledContract = CompiledContract.make('blindroute', BlindRoute.Contract).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets('.'),
);

export interface EscrowLedgerState {
  state: 'EMPTY' | 'LOCKED' | 'RELEASED';
  amount: bigint;
  deliveryCommitment: string;
  courier: string;
}

/** Generates a fresh set of BlindRoute private-state secrets (courier key + delivery-proof secret). */
export const generateBlindRoutePrivateState = (): BlindRoutePrivateState => ({
  secretKey: crypto.getRandomValues(new Uint8Array(32)),
  deliveryProofSecret: crypto.getRandomValues(new Uint8Array(32)),
});

/**
 * Computes the public commitment for a delivery-proof secret entirely off-chain,
 * via the contract's exported pure circuit — no network call, no ledger state.
 * The customer (locking) and courier (releasing) can each compute this
 * independently from the same secret without ever transmitting it.
 */
export const commitmentOf = (proof: Uint8Array): Uint8Array => BlindRoute.pureCircuits.commitmentOf(proof);

/**
 * Wires together the providers midnight-js needs, delegating wallet sync,
 * balancing, signing, and proving to the connected Lace wallet instead of
 * any local wallet code. zkConfigProvider fetches circuit assets from
 * {origin}/keys/{circuit}.prover etc. — served from web/public/keys and
 * web/public/zkir at this app's own origin.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const buildProviders = async (connectedApi: ConnectedAPI, configuration: Configuration): Promise<any> => {
  const zkConfigProvider = new FetchZkConfigProvider<'lockEscrow' | 'releaseEscrow'>(
    window.location.origin,
    fetch.bind(window),
  );
  // Some wallet builds don't implement getProvingProvider() yet — fall back to
  // a local proof server (see README) instead of asking the wallet to prove.
  const proofProvider =
    typeof connectedApi.getProvingProvider === 'function'
      ? createProofProvider(await connectedApi.getProvingProvider(zkConfigProvider.asKeyMaterialProvider()))
      : httpClientProofProvider('http://localhost:6300', zkConfigProvider);

  const shieldedAddresses = await connectedApi.getShieldedAddresses();

  return {
    privateStateProvider: inMemoryPrivateStateProvider<string, BlindRoutePrivateState>(),
    publicDataProvider: indexerPublicDataProvider(configuration.indexerUri, configuration.indexerWsUri),
    zkConfigProvider,
    proofProvider,
    walletProvider: {
      getCoinPublicKey: () => shieldedAddresses.shieldedCoinPublicKey,
      getEncryptionPublicKey: () => shieldedAddresses.shieldedEncryptionPublicKey,
      balanceTx: async (tx: UnboundTransaction): Promise<FinalizedTransaction> => {
        const serializedTx = toHex(tx.serialize());
        const received = await connectedApi.balanceUnsealedTransaction(serializedTx);
        return Transaction.deserialize('signature', 'proof', 'binding', fromHex(received.tx)) as FinalizedTransaction;
      },
    },
    midnightProvider: {
      submitTx: async (tx: FinalizedTransaction): Promise<TransactionId> => {
        await connectedApi.submitTransaction(toHex(tx.serialize()));
        return tx.identifiers()[0];
      },
    },
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const deploy = (providers: any, privateState: BlindRoutePrivateState) =>
  deployContract(providers, {
    compiledContract,
    privateStateId: BLINDROUTE_PRIVATE_STATE_ID,
    initialPrivateState: privateState,
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const join = (providers: any, contractAddress: string, privateState: BlindRoutePrivateState) =>
  findDeployedContract(providers, {
    contractAddress,
    compiledContract,
    privateStateId: BLINDROUTE_PRIVATE_STATE_ID,
    initialPrivateState: privateState,
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const lockEscrow = (contract: any, paymentAmount: bigint, commitment: Uint8Array) =>
  contract.callTx.lockEscrow(paymentAmount, commitment);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const releaseEscrow = (contract: any) => contract.callTx.releaseEscrow();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getEscrowLedgerState = async (
  providers: any,
  contractAddress: string,
): Promise<EscrowLedgerState | null> => {
  const contractState = await providers.publicDataProvider.queryContractState(contractAddress);
  if (contractState == null) return null;
  const escrow = BlindRoute.ledger(contractState.data);
  return {
    state: (['EMPTY', 'LOCKED', 'RELEASED'] as const)[escrow.state],
    amount: escrow.amount,
    deliveryCommitment: toHex(Buffer.from(escrow.deliveryCommitment)),
    courier: toHex(Buffer.from(escrow.courier)),
  };
};
