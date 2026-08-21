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
  refundEscrow,
  releaseEscrow,
  tick,
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
const lockRefundTicksInput = document.getElementById('lock-refund-ticks') as HTMLInputElement;
const lockButton = document.getElementById('lock') as HTMLButtonElement;
const releaseButton = document.getElementById('release') as HTMLButtonElement;
const refundButton = document.getElementById('refund') as HTMLButtonElement;
const tickButton = document.getElementById('tick') as HTMLButtonElement;
const proceedToReleaseButton = document.getElementById('proceed-to-release') as HTMLButtonElement;

// ── Stage / step-tracker rendering ──────────────────────────────────────────
type Stage = 'disconnected' | 'connected' | 'empty' | 'locking' | 'locked' | 'releasing' | 'released' | 'error';

const STEP_FOR_STAGE: Record<Stage, 'connect' | 'contract' | 'lock' | 'release'> = {
  disconnected: 'connect',
  connected: 'contract',
  empty: 'lock',
  locking: 'lock',
  locked: 'lock',
  releasing: 'release',
  released: 'release',
  error: 'connect',
};

const STEP_ORDER = ['connect', 'contract', 'lock', 'release'] as const;

const showStage = (stage: Stage): void => {
  document.querySelectorAll<HTMLElement>('[data-stage]').forEach((el) => {
    el.classList.toggle('is-active', el.dataset.stage === stage);
  });

  const activeStep = STEP_FOR_STAGE[stage];
  const activeIdx = STEP_ORDER.indexOf(activeStep);
  // A stage counts its own step "done" once escrow is LOCKED or RELEASED (terminal for that step).
  const doneIdx = stage === 'locked' || stage === 'releasing' || stage === 'released' ? STEP_ORDER.indexOf('lock') : activeIdx - 1;

  document.querySelectorAll<HTMLElement>('.step-node').forEach((node) => {
    const step = node.dataset.step as (typeof STEP_ORDER)[number];
    const idx = STEP_ORDER.indexOf(step);
    const circle = node.querySelector('.step-circle') as HTMLElement;
    const check = node.querySelector('.step-check') as HTMLElement;
    const num = node.querySelector('.step-num') as HTMLElement;
    const label = node.querySelector('.step-label') as HTMLElement;
    circle.classList.remove('step-pending', 'border-public-zone', 'border-private-zone', 'bg-public-zone', 'text-public-zone');
    label.classList.remove('step-pending', 'text-public-zone', 'text-private-zone');

    if (idx <= doneIdx) {
      circle.classList.add('border-public-zone', 'text-public-zone');
      label.classList.add('text-public-zone');
      check.classList.remove('hidden');
      num.classList.add('hidden');
    } else if (idx === activeIdx) {
      const zoneColor = stage === 'releasing' || stage === 'empty' || stage === 'locking' ? 'private-zone' : 'public-zone';
      circle.classList.add(`border-${zoneColor}`, `text-${zoneColor}`);
      label.classList.add(`text-${zoneColor}`);
      check.classList.add('hidden');
      num.classList.remove('hidden');
    } else {
      circle.classList.add('step-pending');
      label.classList.add('step-pending');
      check.classList.add('hidden');
      num.classList.remove('hidden');
    }
  });

  document.querySelectorAll<HTMLElement>('.nav-link, .nav-link-mobile').forEach((link) => {
    const isActive = link.dataset.nav === activeStep;
    link.classList.toggle('text-primary', isActive);
    link.classList.toggle('text-on-surface-variant', !isActive);
    link.classList.toggle('bg-primary/10', isActive);
  });

  const ledgerCards = document.getElementById('ledger-cards');
  const releaseRow = document.getElementById('release-action-row');
  const showPersistentCards = stage !== 'disconnected' && stage !== 'connected';
  ledgerCards?.classList.toggle('hidden', !showPersistentCards);
  ledgerCards?.classList.toggle('grid', showPersistentCards);
  releaseRow?.classList.toggle('hidden', stage !== 'locked');
  releaseRow?.classList.toggle('flex', stage === 'locked');
};

const showError = (message: string): void => {
  const el = document.getElementById('error-message');
  if (el) el.textContent = message;
  showStage('error');
};

// ── Session state ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let providers: any;
let connection: WalletConnection | undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let activeContract: any;
let activeContractAddress: string | undefined;
// Never rendered to the DOM or logged — only its public commitment hash is.
let privateState: BlindRoutePrivateState | undefined;

const truncateHex = (hex: string): string => (hex.length > 14 ? `${hex.slice(0, 6)}...${hex.slice(-4)}` : hex);

const setEl = (id: string, text: string): void => {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
};

const resetToDisconnected = (): void => {
  connection = undefined;
  providers = undefined;
  activeContract = undefined;
  activeContractAddress = undefined;
  privateState = undefined;

  connectButton.disabled = false;
  disconnectButton.disabled = true;
  setStatus('wallet-status', '');
  const pill = document.getElementById('wallet-status-pill');
  if (pill) pill.textContent = 'Not Connected';
  const dot = document.getElementById('network-dot');
  dot?.classList.remove('bg-public-zone');
  dot?.classList.add('bg-surface-variant');

  deployButton.disabled = true;
  joinAddressInput.disabled = true;
  joinButton.disabled = true;
  setStatus('contract-status', 'No contract active.');

  lockAmountInput.disabled = true;
  lockRefundTicksInput.disabled = true;
  lockButton.disabled = true;
  releaseButton.disabled = true;
  refundButton.disabled = true;
  tickButton.disabled = true;
  setStatus('escrow-status', '');
  setStatus('escrow-status-empty', '');

  showStage('disconnected');
};

const refreshLedgerState = async (): Promise<void> => {
  if (!activeContractAddress) return;
  const escrow = await getEscrowLedgerState(providers, activeContractAddress);
  if (escrow === null) {
    log('No contract state found at this address.');
    return;
  }

  setEl('ledger-status', escrow.state);
  setEl('ledger-amount', escrow.amount.toString());
  setEl('ledger-commitment', truncateHex(escrow.deliveryCommitment));
  setEl('ledger-courier', truncateHex(escrow.courier));
  setEl('ledger-clock', `${escrow.clock} / ${escrow.refundDeadline}`);
  setEl('ledger-contract-id', truncateHex(activeContractAddress));

  // Public ledger state drives which circuit makes sense to call next.
  lockButton.disabled = escrow.state !== 'EMPTY';
  lockAmountInput.disabled = escrow.state !== 'EMPTY';
  lockRefundTicksInput.disabled = escrow.state !== 'EMPTY';
  releaseButton.disabled = escrow.state !== 'LOCKED';
  tickButton.disabled = escrow.state !== 'LOCKED';
  // The button stays enabled once LOCKED even before the deadline passes —
  // the contract itself is the source of truth and will reject an early
  // refund attempt with a clear on-chain assertion error.
  refundButton.disabled = escrow.state !== 'LOCKED';

  if (escrow.state === 'EMPTY') showStage('empty');
  else if (escrow.state === 'LOCKED') showStage('locked');
  else if (escrow.state === 'RELEASED') showStage('released');
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
      const pill = document.getElementById('wallet-status-pill');
      if (pill) pill.textContent = truncateHex(connection.unshieldedAddress);
      document.getElementById('network-dot')?.classList.remove('bg-surface-variant');
      document.getElementById('network-dot')?.classList.add('bg-public-zone');

      disconnectButton.disabled = false;
      deployButton.disabled = false;
      joinAddressInput.disabled = false;
      joinButton.disabled = false;
      showStage('connected');
    } catch (e) {
      const msg = describeError(e);
      log(`Connect error: ${msg}`);
      connectButton.disabled = false;
      showError(msg);
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
    setStatus('contract-status', 'Deploying... (this can take 20-30s)');
    try {
      privateState = generateBlindRoutePrivateState();
      const deployed = await deploy(providers, privateState);
      const address = deployed.deployTxData.public.contractAddress;
      log(`Contract deployed at: ${address}`);
      activateContract(deployed, address);
    } catch (e) {
      const msg = describeError(e);
      log(`Deploy error: ${msg}`);
      showError(msg);
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
    setStatus('contract-status', 'Joining...');
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
      log(`Join error: ${msg}`);
      showError(msg);
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
      setStatus('escrow-status-empty', 'Enter a payment amount greater than zero.', 'error');
      return;
    }
    const refundTicksStr = lockRefundTicksInput.value.trim();
    const refundTicks = BigInt(refundTicksStr || '0');
    lockButton.disabled = true;
    showStage('locking');
    try {
      // The commitment is a public hash — safe to log. The secret behind it never is.
      const commitment = commitmentOf(privateState.deliveryProofSecret);
      log(`Commitment (public, hex): ${Buffer.from(commitment).toString('hex')}`);
      const result = await lockEscrow(activeContract, paymentAmount, commitment, refundTicks);
      log(`Lock tx ${result.public.txId} included at block ${result.public.blockHeight}`);
      await refreshLedgerState();
    } catch (e) {
      const msg = describeError(e);
      log(`Lock error: ${msg}`);
      lockButton.disabled = false;
      showError(msg);
    }
  })();
});

proceedToReleaseButton.addEventListener('click', () => {
  showStage('locked');
});

releaseButton.addEventListener('click', () => {
  void (async () => {
    if (!activeContract) return;
    releaseButton.disabled = true;
    showStage('releasing');
    try {
      const result = await releaseEscrow(activeContract);
      log(`Release tx ${result.public.txId} included at block ${result.public.blockHeight}`);
      await refreshLedgerState();
    } catch (e) {
      const msg = describeError(e);
      log(`Release error: ${msg}`);
      releaseButton.disabled = false;
      showError(msg);
    }
  })();
});

// tick() carries no funds and needs no private witness — it's the public,
// auditable trigger that eventually lets refundEscrow succeed.
tickButton.addEventListener('click', () => {
  void (async () => {
    if (!activeContract) return;
    tickButton.disabled = true;
    try {
      const result = await tick(activeContract);
      log(`Tick tx ${result.public.txId} included at block ${result.public.blockHeight}`);
      await refreshLedgerState();
    } catch (e) {
      const msg = describeError(e);
      log(`Tick error: ${msg}`);
      showError(msg);
    } finally {
      tickButton.disabled = false;
    }
  })();
});

refundButton.addEventListener('click', () => {
  void (async () => {
    if (!activeContract) return;
    refundButton.disabled = true;
    try {
      const result = await refundEscrow(activeContract);
      log(`Refund tx ${result.public.txId} included at block ${result.public.blockHeight}`);
      await refreshLedgerState();
    } catch (e) {
      const msg = describeError(e);
      log(`Refund error: ${msg}`);
      showError(msg);
    } finally {
      refundButton.disabled = false;
    }
  })();
});

resetToDisconnected();
