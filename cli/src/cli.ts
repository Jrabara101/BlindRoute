import { type WalletContext } from './api';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface, type Interface } from 'node:readline/promises';
import { type Logger } from 'pino';
import { type StartedDockerComposeEnvironment, type DockerComposeEnvironment } from 'testcontainers';
import { type BlindRouteProviders, type DeployedBlindRouteContract } from './common-types';
import { type Config, StandaloneConfig } from './config';
import * as api from './api';

let logger: Logger;

/**
 * This seed gives access to tokens minted in the genesis block of a local development node.
 * Only used in standalone networks to build a wallet with initial funds.
 */
const GENESIS_MINT_WALLET_SEED = '0000000000000000000000000000000000000000000000000000000000000001';

// ─── Display Helpers ────────────────────────────────────────────────────────

const BANNER = `
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║              BlindRoute Escrow Example                       ║
║              ──────────────────────────                      ║
║              A private delivery-escrow smart contract demo   ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`;

const DIVIDER = '──────────────────────────────────────────────────────────────';

// ─── Menu Helpers ──────────────────────────────────────────────────────────

const WALLET_MENU = `
${DIVIDER}
  Wallet Setup
${DIVIDER}
  [1] Create a new wallet
  [2] Restore wallet from seed
  [3] Exit
${'─'.repeat(62)}
> `;

/** Build the contract actions menu, showing current DUST balance in the header. */
const contractMenu = (dustBalance: string) => `
${DIVIDER}
  Contract Actions${dustBalance ? `                    DUST: ${dustBalance}` : ''}
${DIVIDER}
  [1] Deploy a new BlindRoute escrow contract
  [2] Join an existing BlindRoute escrow contract
  [3] Monitor DUST balance
  [4] Exit
${'─'.repeat(62)}
> `;

/** Build the escrow actions menu, showing current DUST balance in the header. */
const escrowMenu = (dustBalance: string) => `
${DIVIDER}
  Escrow Actions${dustBalance ? `                      DUST: ${dustBalance}` : ''}
${DIVIDER}
  [1] Lock escrow (deposit + delivery commitment)
  [2] Release escrow (prove delivery, claim payment)
  [3] Display current escrow state
  [4] Exit
${'─'.repeat(62)}
> `;

// ─── Wallet Setup ───────────────────────────────────────────────────────────

/** Prompt the user for a seed phrase and restore a wallet from it. */
const buildWalletFromSeed = async (config: Config, rli: Interface): Promise<WalletContext> => {
  const seed = await rli.question('Enter your wallet seed: ');
  return await api.buildWalletAndWaitForFunds(config, seed);
};

/**
 * Wallet creation flow.
 * - Standalone configs skip the menu and use the genesis seed automatically.
 * - All other configs present a menu to create or restore a wallet.
 */
const buildWallet = async (config: Config, rli: Interface): Promise<WalletContext | null> => {
  // Standalone mode: use the pre-funded genesis wallet
  if (config instanceof StandaloneConfig) {
    return await api.buildWalletAndWaitForFunds(config, GENESIS_MINT_WALLET_SEED);
  }

  while (true) {
    const choice = await rli.question(WALLET_MENU);
    switch (choice.trim()) {
      case '1':
        return await api.buildFreshWallet(config);
      case '2':
        return await buildWalletFromSeed(config, rli);
      case '3':
        return null;
      default:
        logger.error(`Invalid choice: ${choice}`);
    }
  }
};

// ─── Contract Interaction ───────────────────────────────────────────────────

/** Format dust balance for menu headers. */
const getDustLabel = async (wallet: api.WalletContext['wallet']): Promise<string> => {
  try {
    const dust = await api.getDustBalance(wallet);
    return dust.available.toLocaleString();
  } catch {
    return '';
  }
};

/** Prompt for a contract address and join an existing deployed contract. */
const joinContract = async (
  providers: BlindRouteProviders,
  rli: Interface,
  privateState: ReturnType<typeof api.generateBlindRoutePrivateState>,
): Promise<DeployedBlindRouteContract> => {
  const contractAddress = await rli.question('Enter the contract address (hex): ');
  return await api.joinContract(providers, contractAddress, privateState);
};

/**
 * Start the DUST monitor. Shows a live-updating balance display
 * that runs until the user presses Enter.
 */
const startDustMonitor = async (wallet: api.WalletContext['wallet'], rli: Interface): Promise<void> => {
  console.log('');
  // Use readline question to wait for Enter — the monitor will render above this line
  const stopPromise = rli.question('  Press Enter to return to menu...\n').then(() => {});
  await api.monitorDustBalance(wallet, stopPromise);
  console.log('');
};

/**
 * Deploy or join flow. Returns the contract handle, or null if the user exits.
 * Errors during deploy/join are caught and displayed — the user stays in the menu.
 *
 * A fresh set of private-state secrets (courier key + delivery-proof secret) is
 * generated once per session and reused for both deploy and join, since this demo
 * CLI plays both the customer and courier role locally.
 */
const deployOrJoin = async (
  providers: BlindRouteProviders,
  walletCtx: api.WalletContext,
  rli: Interface,
): Promise<{ contract: DeployedBlindRouteContract; privateState: ReturnType<typeof api.generateBlindRoutePrivateState> } | null> => {
  const privateState = api.generateBlindRoutePrivateState();
  while (true) {
    const dustLabel = await getDustLabel(walletCtx.wallet);
    const choice = await rli.question(contractMenu(dustLabel));
    switch (choice.trim()) {
      case '1':
        try {
          const contract = await api.withStatus('Deploying BlindRoute escrow contract', () =>
            api.deploy(providers, privateState),
          );
          console.log(`  Contract deployed at: ${contract.deployTxData.public.contractAddress}\n`);
          return { contract, privateState };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(`\n  ✗ Deploy failed: ${msg}`);
          // Log the full cause chain to help debug WASM/ledger errors
          if (e instanceof Error && e.cause) {
            let cause: unknown = e.cause;
            let depth = 0;
            while (cause && depth < 5) {
              const causeMsg =
                cause instanceof Error
                  ? `${cause.message}\n      ${cause.stack?.split('\n').slice(1, 3).join('\n      ') ?? ''}`
                  : String(cause);
              console.log(`    cause: ${causeMsg}`);
              cause = cause instanceof Error ? cause.cause : undefined;
              depth++;
            }
          }
          if (msg.toLowerCase().includes('dust') || msg.toLowerCase().includes('no dust')) {
            console.log('    Insufficient DUST for transaction fees. Use option [3] to monitor your balance.');
          }
          console.log('');
        }
        break;
      case '2':
        try {
          const contract = await joinContract(providers, rli, privateState);
          return { contract, privateState };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(`  ✗ Failed to join contract: ${msg}\n`);
        }
        break;
      case '3':
        await startDustMonitor(walletCtx.wallet, rli);
        break;
      case '4':
        return null;
      default:
        console.log(`  Invalid choice: ${choice}`);
    }
  }
};

/**
 * Main interaction loop. Once a contract is deployed/joined, the user can
 * lock an escrow, release it by proving the delivery secret, or query state.
 */
const mainLoop = async (providers: BlindRouteProviders, walletCtx: api.WalletContext, rli: Interface): Promise<void> => {
  const deployed = await deployOrJoin(providers, walletCtx, rli);
  if (deployed === null) {
    return;
  }
  const { contract: blindRouteContract, privateState } = deployed;

  while (true) {
    const dustLabel = await getDustLabel(walletCtx.wallet);
    const choice = await rli.question(escrowMenu(dustLabel));
    switch (choice.trim()) {
      case '1':
        try {
          const amountStr = await rli.question('  Payment amount (integer): ');
          const paymentAmount = BigInt(amountStr.trim());
          const commitment = api.commitmentOf(privateState.deliveryProofSecret);
          await api.withStatus('Locking escrow', () => api.lockEscrow(blindRouteContract, paymentAmount, commitment));
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(`  ✗ Lock failed: ${msg}\n`);
        }
        break;
      case '2':
        try {
          await api.withStatus('Releasing escrow', () => api.releaseEscrow(blindRouteContract));
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(`  ✗ Release failed: ${msg}\n`);
        }
        break;
      case '3':
        await api.displayEscrowState(providers, blindRouteContract);
        break;
      case '4':
        return;
      default:
        console.log(`  Invalid choice: ${choice}`);
    }
  }
};

// ─── Docker Port Mapping ────────────────────────────────────────────────────

/** Map a container's first exposed port into the config URL. */
const mapContainerPort = (env: StartedDockerComposeEnvironment, url: string, containerName: string) => {
  const mappedUrl = new URL(url);
  const container = env.getContainer(containerName);
  mappedUrl.port = String(container.getFirstMappedPort());
  return mappedUrl.toString().replace(/\/+$/, '');
};

// ─── Entry Point ────────────────────────────────────────────────────────────

/**
 * Main entry point for the CLI.
 *
 * Flow:
 *   1. (Optional) Start Docker containers for proof server / node / indexer
 *   2. Build or restore a wallet and wait for it to be funded
 *   3. Configure midnight-js providers (proof server, indexer, wallet, private state)
 *   4. Enter the contract deploy/join and escrow interaction loop
 *   5. Clean up: close wallet, readline, and docker environment
 */
export const run = async (config: Config, _logger: Logger, dockerEnv?: DockerComposeEnvironment): Promise<void> => {
  logger = _logger;
  api.setLogger(_logger);

  // Print the title banner
  console.log(BANNER);

  const rli = createInterface({ input, output, terminal: true });
  let env: StartedDockerComposeEnvironment | undefined;

  try {
    // Step 1: Start Docker environment if provided (e.g. local proof server)
    if (dockerEnv !== undefined) {
      env = await dockerEnv.up();

      // In standalone mode, remap ports to the dynamically assigned container ports
      if (config instanceof StandaloneConfig) {
        config.indexer = mapContainerPort(env, config.indexer, 'blindroute-indexer');
        config.indexerWS = mapContainerPort(env, config.indexerWS, 'blindroute-indexer');
        config.node = mapContainerPort(env, config.node, 'blindroute-node');
        config.proofServer = mapContainerPort(env, config.proofServer, 'blindroute-proof-server');
      }
    }

    // Step 2: Build wallet (create new or restore from seed)
    const walletCtx = await buildWallet(config, rli);
    if (walletCtx === null) {
      return;
    }

    try {
      // Step 3: Configure midnight-js providers
      const providers = await api.withStatus('Configuring providers', () => api.configureProviders(walletCtx, config));
      console.log('');

      // Step 4: Enter the contract interaction loop
      await mainLoop(providers, walletCtx, rli);
    } catch (e) {
      if (e instanceof Error) {
        logger.error(`Error: ${e.message}`);
        logger.debug(`${e.stack}`);
      } else {
        throw e;
      }
    } finally {
      // Step 5a: Stop the wallet
      try {
        await walletCtx.wallet.stop();
      } catch (e) {
        logger.error(`Error stopping wallet: ${e}`);
      }
    }
  } finally {
    // Step 5b: Close readline and Docker environment
    rli.close();
    rli.removeAllListeners();

    if (env !== undefined) {
      try {
        await env.down();
      } catch (e) {
        logger.error(`Error shutting down docker environment: ${e}`);
      }
    }

    logger.info('Goodbye.');
  }
};
