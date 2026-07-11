import { BlindRoute, type BlindRoutePrivateState } from '@midnight-ntwrk/blindroute-contract';
import type { MidnightProviders } from '@midnight-ntwrk/midnight-js/types';
import type { DeployedContract, FoundContract } from '@midnight-ntwrk/midnight-js/contracts';
import type { ProvableCircuitId } from '@midnight-ntwrk/compact-js';

export type BlindRouteCircuits = ProvableCircuitId<BlindRoute.Contract<BlindRoutePrivateState>>;

export const BlindRoutePrivateStateId = 'blindroutePrivateState';

export type BlindRouteProviders = MidnightProviders<
  BlindRouteCircuits,
  typeof BlindRoutePrivateStateId,
  BlindRoutePrivateState
>;

export type BlindRouteContract = BlindRoute.Contract<BlindRoutePrivateState>;

export type DeployedBlindRouteContract = DeployedContract<BlindRouteContract> | FoundContract<BlindRouteContract>;
