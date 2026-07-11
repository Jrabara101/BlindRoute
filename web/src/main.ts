// Buffer polyfill: some Midnight SDK packages assume a Node-like Buffer global.
import { Buffer } from 'buffer';
(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;

import type { InitialAPI, ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { deployContract } from '@midnight-ntwrk/midnight-js/contracts';
import { setNetworkId } from '@midnight-ntwrk/midnight-js/network-id';
import { createProofProvider, type UnboundTransaction } from '@midnight-ntwrk/midnight-js/types';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { toHex, fromHex } from '@midnight-ntwrk/midnight-js/utils';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import {
  Transaction,
  type FinalizedTransaction,
  type TransactionId,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { BlindRoute, witnesses, type BlindRoutePrivateState } from '@midnight-ntwrk/blindroute-contract';
import { inMemoryPrivateStateProvider } from './in-memory-private-state-provider';

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
  const connectedApi = await wallet.connect('preprod');
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
      const zkConfigProvider = new FetchZkConfigProvider<'lockEscrow' | 'releaseEscrow'>(window.location.origin);
      const provingProvider = await connectedApi.getProvingProvider(zkConfigProvider.asKeyMaterialProvider());
      const proofProvider = createProofProvider(provingProvider);

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
      const msg = e instanceof Error ? e.message : String(e);
      setStatus('deploy-status', `failed: ${msg}`);
      log(`Deploy error: ${msg}`);
      if (e instanceof Error && e.stack) log(e.stack);
      deployButton.disabled = false;
    }
  })();
});
