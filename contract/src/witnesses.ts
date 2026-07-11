/*
 * Defines the shape of BlindRoute's private state and the two witness
 * functions the contract calls into: localSecretKey (courier identity)
 * and deliveryProof (the secret behind the public delivery commitment).
 * Neither value ever leaves this local state or gets written to the ledger.
 */

import { type Ledger } from "./managed/blindroute/contract/index.js";
import { type WitnessContext } from "@midnight-ntwrk/compact-runtime";

export type BlindRoutePrivateState = {
  readonly secretKey: Uint8Array;
  readonly deliveryProofSecret: Uint8Array;
};

export const createBlindRoutePrivateState = (
  secretKey: Uint8Array,
  deliveryProofSecret: Uint8Array,
): BlindRoutePrivateState => ({ secretKey, deliveryProofSecret });

export const witnesses = {
  localSecretKey: ({
    privateState,
  }: WitnessContext<Ledger, BlindRoutePrivateState>): [BlindRoutePrivateState, Uint8Array] => [
    privateState,
    privateState.secretKey,
  ],
  deliveryProof: ({
    privateState,
  }: WitnessContext<Ledger, BlindRoutePrivateState>): [BlindRoutePrivateState, Uint8Array] => [
    privateState,
    privateState.deliveryProofSecret,
  ],
};
