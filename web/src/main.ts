// Buffer polyfill: some Midnight SDK packages assume a Node-like Buffer global.
import { Buffer } from 'buffer';
(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;

import type { InitialAPI, ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { deployContract } from '@midnight-ntwrk/midnight-js/contracts';
import { setNetworkId } from '@midnight-ntwrk/midnight-js/network-id';
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
import { Cause } from 'effect';

declare global {
  interface Window {
    midnight?: Record<string, InitialAPI>;
  }
}

const log = (msg: string): void => {
  const el = document.getElementById('log');
  if (el) el.textContent += `${msg}\n`;
  console.log(msg);
};

const setStatus = (id: string, text: string): void => {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
};

const generateBlindRoutePrivateState = (): BlindRoutePrivateState => ({
  secretKey: crypto.getRandomValues(new Uint8Array(32)),
  deliveryProofSecret: crypto.getRandomValues(new Uint8Array(32)),
});

const listWallets = (): InitialAPI[] => (window.midnight ? Object.values(window.midnight) : []);

const connectToWallet = async (): Promise<ConnectedAPI> => {
  const wallets = listWallets();
  if (wallets.length === 0) {
    throw new Error('No Midnight wallet found. Install the Lace wallet extension, then reload this page.');
  }
  const wallet = wallets[0];
  log(`Found wallet: ${wallet.name} (apiVersion ${wallet.apiVersion})`);
  const connectedApi = await wallet.connect('preview');
  const status = await connectedApi.getConnectionStatus();
  if (status.status !== 'connected') {
    throw new Error('Wallet did not report a connected status after connect().');
  }
  log(`Connected to network: ${status.networkId}`);
  return connectedApi;
};

let connectedApi: ConnectedAPI | undefined;

const connectButton = document.getElementById('connect') as HTMLButtonElement;
const deployButton = document.getElementById('deploy') as HTMLButtonElement;

connectButton.addEventListener('click', () => {
  void (async () => {
    connectButton.disabled = true;
    setStatus('connect-status', 'connecting...');
    try {
      connectedApi = await connectToWallet();
      const { unshieldedAddress } = await connectedApi.getUnshieldedAddress();
      setStatus('connect-status', `connected: ${unshieldedAddress}`);
      deployButton.disabled = false;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus('connect-status', `failed: ${msg}`);
      log(`Connect error: ${msg}`);
      connectButton.disabled = false;
    }
  })();
});

deployButton.addEventListener('click', () => {
  void (async () => {
    if (!connectedApi) return;
    deployButton.disabled = true;
    setStatus('deploy-status', 'deploying... (this can take 20-30s)');
    try {
      const configuration = await connectedApi.getConfiguration();
      setNetworkId(configuration.networkId as Parameters<typeof setNetworkId>[0]);
      log(`Network: ${configuration.networkId}`);
      log(`Indexer: ${configuration.indexerUri}`);

      // FetchZkConfigProvider fetches circuit assets from {origin}/keys/{circuit}.prover etc.
      // — served directly from web/public/keys and web/public/zkir at this app's origin.
      const zkConfigProvider = new FetchZkConfigProvider<'lockEscrow' | 'releaseEscrow'>(
        window.location.origin,
        fetch.bind(window),
      );
      // Some wallet builds (e.g. the deprecated Lace Midnight Preview extension) don't
      // implement getProvingProvider() yet. Fall back to proving via our own local proof
      // server (started earlier for the CLI work) instead of asking the wallet to prove.
      const proofProvider =
        typeof connectedApi.getProvingProvider === 'function'
          ? createProofProvider(await connectedApi.getProvingProvider(zkConfigProvider.asKeyMaterialProvider()))
          : httpClientProofProvider('http://localhost:6300', zkConfigProvider);

      const shieldedAddresses = await connectedApi.getShieldedAddresses();

      const compiledContract = CompiledContract.make('blindroute', BlindRoute.Contract).pipe(
        CompiledContract.withWitnesses(witnesses),
        CompiledContract.withCompiledFileAssets('.'),
      );

      const providers = {
        privateStateProvider: inMemoryPrivateStateProvider<string, BlindRoutePrivateState>(),
        publicDataProvider: indexerPublicDataProvider(configuration.indexerUri, configuration.indexerWsUri),
        zkConfigProvider,
        proofProvider,
        walletProvider: {
          getCoinPublicKey: () => shieldedAddresses.shieldedCoinPublicKey,
          getEncryptionPublicKey: () => shieldedAddresses.shieldedEncryptionPublicKey,
          balanceTx: async (tx: UnboundTransaction): Promise<FinalizedTransaction> => {
            log('Balancing transaction via Lace...');
            const serializedTx = toHex(tx.serialize());
            const received = await connectedApi!.balanceUnsealedTransaction(serializedTx);
            return Transaction.deserialize('signature', 'proof', 'binding', fromHex(received.tx)) as FinalizedTransaction;
          },
        },
        midnightProvider: {
          submitTx: async (tx: FinalizedTransaction): Promise<TransactionId> => {
            log('Submitting transaction via Lace...');
            await connectedApi!.submitTransaction(toHex(tx.serialize()));
            return tx.identifiers()[0];
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      const privateState = generateBlindRoutePrivateState();
      const deployed = await deployContract(providers, {
        compiledContract,
        privateStateId: 'blindroutePrivateState',
        initialPrivateState: privateState,
      });

      const address = deployed.deployTxData.public.contractAddress;
      setStatus('deploy-status', 'deployed!');
      log(`Contract deployed at: ${address}`);
    } catch (e) {
      console.error('Raw deploy error object:', e);
      let msg = e instanceof Error ? e.message : String(e);
      // Effect.js FiberFailure: .message is always empty, the real reason is in .cause (a Cause<E>).
      if (!msg && e && typeof e === 'object' && 'cause' in e) {
        try {
          msg = Cause.pretty((e as { cause: Cause.Cause<unknown> }).cause);
        } catch {
          // fall through
        }
      }
      if (!msg) {
        try {
          msg = JSON.stringify(e, Object.getOwnPropertyNames(e as object));
        } catch {
          msg = '(unstringifiable error — check browser console for the raw object)';
        }
      }
      setStatus('deploy-status', `failed: ${msg}`);
      log(`Deploy error: ${msg}`);
      if (e instanceof Error && e.stack) log(e.stack);
      deployButton.disabled = false;
    }
  })();
});
