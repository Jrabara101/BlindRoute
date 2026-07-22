// Buffer polyfill: some Midnight SDK packages assume a Node-like Buffer global.
import { Buffer } from 'buffer';
(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;

import { setNetworkId } from '@midnight-ntwrk/midnight-js/network-id';
import type { BlindRoutePrivateState } from '@midnight-ntwrk/blindroute-contract';
import { connectWallet, type WalletConnection } from './wallet';
import {
  buildProviders,
  commitmentOf,
  deploy,
  generateBlindRoutePrivateState,
  getEscrowLedgerState,
  join,
  lockEscrow,
  releaseEscrow,
} from './contract';
import { describeError } from './errors';

const log = (msg: string): void => {
  const el = document.getElementById('log');
  if (el) el.textContent += `${msg}\n`;
  console.log(msg);
};

const setStatus = (id: string, text: string, cls?: 'error' | 'ok'): void => {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = cls ?? '';
};

// ── DOM refs ────────────────────────────────────────────────────────────────
const connectButton = document.getElementById('connect') as HTMLButtonElement;
const disconnectButton = document.getElementById('disconnect') as HTMLButtonElement;
const deployButton = document.getElementById('deploy') as HTMLButtonElement;
const joinAddressInput = document.getElementById('join-address') as HTMLInputElement;
const joinButton = document.getElementById('join') as HTMLButtonElement;
const lockAmountInput = document.getElementById('lock-amount') as HTMLInputElement;
const lockButton = document.getElementById('lock') as HTMLButtonElement;
const releaseButton = document.getElementById('release') as HTMLButtonElement;

// ── Session state ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let providers: any;
let connection: WalletConnection | undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let activeContract: any;
let activeContractAddress: string | undefined;
// Never rendered to the DOM or logged — only its public commitment hash is.
let privateState: BlindRoutePrivateState | undefined;

const resetToDisconnected = (): void => {
  connection = undefined;
  providers = undefined;
  activeContract = undefined;
  activeContractAddress = undefined;
  privateState = undefined;

  connectButton.disabled = false;
  disconnectButton.disabled = true;
  setStatus('wallet-status', 'Not connected.');

  deployButton.disabled = true;
  joinAddressInput.disabled = true;
  joinButton.disabled = true;
  setStatus('contract-status', 'No contract active.');

  lockAmountInput.disabled = true;
  lockButton.disabled = true;
  releaseButton.disabled = true;
  setStatus('escrow-status', '—');
  setStatus('ledger-state', 'No ledger state yet.');
};

const refreshLedgerState = async (): Promise<void> => {
  if (!activeContractAddress) return;
  const ledgerEl = document.getElementById('ledger-state');
  if (!ledgerEl) return;
  const escrow = await getEscrowLedgerState(providers, activeContractAddress);
  if (escrow === null) {
    ledgerEl.textContent = 'No contract state found at this address.';
    return;
  }
  ledgerEl.textContent = JSON.stringify({ ...escrow, amount: escrow.amount.toString() }, null, 2);

  // Public ledger state drives which circuit makes sense to call next.
  lockButton.disabled = escrow.state !== 'EMPTY';
  lockAmountInput.disabled = escrow.state !== 'EMPTY';
  releaseButton.disabled = escrow.state !== 'LOCKED';
};

// ── Wallet connect / disconnect ──────────────────────────────────────────────
connectButton.addEventListener('click', () => {
  void (async () => {
    connectButton.disabled = true;
    setStatus('wallet-status', 'connecting...');
    try {
      connection = await connectWallet();
      log(`Connected to network: ${connection.networkId}`);
      setNetworkId(connection.networkId as Parameters<typeof setNetworkId>[0]);

      const configuration = await connection.api.getConfiguration();
      log(`Indexer: ${configuration.indexerUri}`);
      providers = await buildProviders(connection.api, configuration);

      setStatus('wallet-status', `connected: ${connection.unshieldedAddress}`, 'ok');
      disconnectButton.disabled = false;
      deployButton.disabled = false;
      joinAddressInput.disabled = false;
      joinButton.disabled = false;
    } catch (e) {
      const msg = describeError(e);
      setStatus('wallet-status', `failed: ${msg}`, 'error');
      log(`Connect error: ${msg}`);
      connectButton.disabled = false;
    }
  })();
});

// There is no wallet-side "disconnect" call in the DApp Connector API (no
// session teardown exists in the injected API) — disconnecting here just
// means this app stops holding the wallet reference and forgets the active
// contract/private state, returning the UI to its pre-connection state.
disconnectButton.addEventListener('click', () => {
  resetToDisconnected();
  log('Disconnected.');
});

// ── Deploy / join contract ───────────────────────────────────────────────────
const activateContract = (contract: unknown, address: string): void => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activeContract = contract as any;
  activeContractAddress = address;
  setStatus('contract-status', `Active contract: ${address}`, 'ok');
  lockAmountInput.disabled = false;
  lockButton.disabled = false;
  void refreshLedgerState();
};

deployButton.addEventListener('click', () => {
  void (async () => {
    if (!providers) return;
    deployButton.disabled = true;
    joinButton.disabled = true;
    setStatus('contract-status', 'deploying... (this can take 20-30s)');
    try {
      privateState = generateBlindRoutePrivateState();
      const deployed = await deploy(providers, privateState);
      const address = deployed.deployTxData.public.contractAddress;
      log(`Contract deployed at: ${address}`);
      activateContract(deployed, address);
    } catch (e) {
      const msg = describeError(e);
      setStatus('contract-status', `deploy failed: ${msg}`, 'error');
      log(`Deploy error: ${msg}`);
    } finally {
      deployButton.disabled = false;
      joinButton.disabled = false;
    }
  })();
});

joinButton.addEventListener('click', () => {
  void (async () => {
    if (!providers) return;
    const address = joinAddressInput.value.trim();
    if (!address) {
      setStatus('contract-status', 'Enter a contract address to join.', 'error');
      return;
    }
    deployButton.disabled = true;
    joinButton.disabled = true;
    setStatus('contract-status', 'joining...');
    try {
      // A fresh private state means release will only succeed if this same
      // session also locked the escrow (its deliveryProofSecret must match
      // the commitment already on-chain) — see README for why this is by design.
      privateState = generateBlindRoutePrivateState();
      const found = await join(providers, address, privateState);
      log(`Joined contract at: ${address}`);
      activateContract(found, address);
    } catch (e) {
      const msg = describeError(e);
      setStatus('contract-status', `join failed: ${msg}`, 'error');
      log(`Join error: ${msg}`);
    } finally {
      deployButton.disabled = false;
      joinButton.disabled = false;
    }
  })();
});

// ── Escrow circuits ──────────────────────────────────────────────────────────
lockButton.addEventListener('click', () => {
  void (async () => {
    if (!activeContract || !privateState) return;
    const amountStr = lockAmountInput.value.trim();
    const paymentAmount = BigInt(amountStr || '0');
    if (paymentAmount <= 0n) {
      setStatus('escrow-status', 'Enter a payment amount greater than zero.', 'error');
      return;
    }
    lockButton.disabled = true;
    setStatus('escrow-status', 'locking escrow... (generating proof locally)');
    try {
      // The commitment is a public hash — safe to log. The secret behind it never is.
      const commitment = commitmentOf(privateState.deliveryProofSecret);
      log(`Commitment (public, hex): ${Buffer.from(commitment).toString('hex')}`);
      const result = await lockEscrow(activeContract, paymentAmount, commitment);
      log(`Lock tx ${result.public.txId} included at block ${result.public.blockHeight}`);
      setStatus('escrow-status', `Escrow locked for ${paymentAmount}.`, 'ok');
      await refreshLedgerState();
    } catch (e) {
      const msg = describeError(e);
      setStatus('escrow-status', `lock failed: ${msg}`, 'error');
      log(`Lock error: ${msg}`);
      lockButton.disabled = false;
    }
  })();
});

releaseButton.addEventListener('click', () => {
  void (async () => {
    if (!activeContract) return;
    releaseButton.disabled = true;
    setStatus('escrow-status', 'releasing escrow... (proving delivery locally — this can take a while)');
    try {
      const result = await releaseEscrow(activeContract);
      log(`Release tx ${result.public.txId} included at block ${result.public.blockHeight}`);
      setStatus('escrow-status', 'Escrow released — proved without revealing your input.', 'ok');
      await refreshLedgerState();
    } catch (e) {
      const msg = describeError(e);
      setStatus('escrow-status', `release failed: ${msg}`, 'error');
      log(`Release error: ${msg}`);
      releaseButton.disabled = false;
    }
  })();
});

resetToDisconnected();
