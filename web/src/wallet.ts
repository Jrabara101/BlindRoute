// Lace wallet connection via the Midnight DApp Connector API.
//
// The connector has no wallet-side "disconnect" call (there's no session
// teardown in the injected API) — disconnecting is a DApp-local concept:
// stop holding the ConnectedAPI reference and reset the UI. See
// disconnectWallet() below.

import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';

// Level 2 requires deployment and interaction on Preprod specifically.
export const REQUIRED_NETWORK_ID = 'preprod';

export class WalletError extends Error {}

export const listWallets = (): InitialAPI[] => (window.midnight ? Object.values(window.midnight) : []);

/** Narrow an unknown thrown value down to the DApp Connector's APIError shape, if it matches. */
const asApiError = (e: unknown): { code?: string; reason?: string } | null => {
  if (e && typeof e === 'object' && 'type' in e && (e as { type?: unknown }).type === 'DAppConnectorAPIError') {
    return e as { code?: string; reason?: string };
  }
  return null;
};

/** True if the given error represents the user dismissing/rejecting a Lace prompt. */
export const isUserRejection = (e: unknown): boolean => {
  const apiError = asApiError(e);
  return apiError?.code === 'Rejected' || apiError?.code === 'PermissionRejected';
};

const describeError = (e: unknown): string => {
  const apiError = asApiError(e);
  if (apiError) return apiError.reason ?? apiError.code ?? 'Unknown wallet error';
  return e instanceof Error ? e.message : String(e);
};

export interface WalletConnection {
  api: ConnectedAPI;
  networkId: string;
  unshieldedAddress: string;
}

/**
 * Connect to the first injected Midnight wallet (Lace), then verify it
 * actually landed on the network this app requires. connect() only *hints*
 * the desired network — the wallet may stay on whatever network the user
 * has it configured for, so the mismatch has to be checked after the fact.
 */
export const connectWallet = async (): Promise<WalletConnection> => {
  const wallets = listWallets();
  if (wallets.length === 0) {
    throw new WalletError('No Midnight wallet found. Install the Lace wallet extension, then reload this page.');
  }
  const wallet = wallets[0];

  let connectedApi: ConnectedAPI;
  try {
    connectedApi = await wallet.connect(REQUIRED_NETWORK_ID);
  } catch (e) {
    if (isUserRejection(e)) {
      throw new WalletError('Connection request was rejected in Lace.');
    }
    throw new WalletError(`Failed to connect to ${wallet.name}: ${describeError(e)}`);
  }

  const status = await connectedApi.getConnectionStatus();
  if (status.status !== 'connected') {
    throw new WalletError('Wallet did not report a connected status after connect().');
  }
  if (status.networkId !== REQUIRED_NETWORK_ID) {
    throw new WalletError(
      `Lace is connected to network '${status.networkId}', but this app requires '${REQUIRED_NETWORK_ID}'. ` +
        `Switch Lace's active network to Preprod (wallet settings) and reconnect.`,
    );
  }

  const { unshieldedAddress } = await connectedApi.getUnshieldedAddress();
  return { api: connectedApi, networkId: status.networkId, unshieldedAddress };
};
