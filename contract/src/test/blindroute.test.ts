import { BlindRouteSimulator } from "./blindroute-simulator.js";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, it, expect } from "vitest";
import { randomBytes } from "./utils.js";
import { EscrowState } from "../managed/blindroute/contract/index.js";

setNetworkId("undeployed");

describe("BlindRoute escrow contract", () => {
  it("generates initial ledger state deterministically", () => {
    const key = randomBytes(32);
    const proof = randomBytes(32);
    const simulator0 = new BlindRouteSimulator(key, proof);
    const simulator1 = new BlindRouteSimulator(key, proof);
    expect(simulator0.getLedger()).toEqual(simulator1.getLedger());
  });

  it("starts empty with zero amount and no committed courier", () => {
    const simulator = new BlindRouteSimulator(randomBytes(32), randomBytes(32));
    const ledgerState = simulator.getLedger();
    expect(ledgerState.state).toEqual(EscrowState.EMPTY);
    expect(ledgerState.amount).toEqual(0n);
    expect(ledgerState.courier).toEqual(new Uint8Array(32));
  });

  it("locks an escrow with a payment amount and delivery commitment", () => {
    const simulator = new BlindRouteSimulator(randomBytes(32), randomBytes(32));
    const proof = simulator.getPrivateState().deliveryProofSecret;
    const commitment = simulator.commitmentOf(proof);

    const ledgerState = simulator.lockEscrow(2_500n, commitment);
    expect(ledgerState.state).toEqual(EscrowState.LOCKED);
    expect(ledgerState.amount).toEqual(2_500n);
    expect(ledgerState.deliveryCommitment).toEqual(commitment);
  });

  it("won't lock an escrow that is already locked", () => {
    const simulator = new BlindRouteSimulator(randomBytes(32), randomBytes(32));
    const commitment = simulator.commitmentOf(simulator.getPrivateState().deliveryProofSecret);
    simulator.lockEscrow(1_000n, commitment);
    expect(() => simulator.lockEscrow(1_000n, commitment)).toThrow(
      "failed assert: Escrow already locked or released",
    );
  });

  it("releases the escrow when the courier proves the correct delivery secret", () => {
    const simulator = new BlindRouteSimulator(randomBytes(32), randomBytes(32));
    const proof = simulator.getPrivateState().deliveryProofSecret;
    const commitment = simulator.commitmentOf(proof);
    simulator.lockEscrow(1_000n, commitment);

    const ledgerState = simulator.releaseEscrow();
    expect(ledgerState.state).toEqual(EscrowState.RELEASED);
    expect(ledgerState.courier).toEqual(simulator.courierPublicKey());
    // the payment amount and commitment remain on the public record
    expect(ledgerState.amount).toEqual(1_000n);
    expect(ledgerState.deliveryCommitment).toEqual(commitment);
  });

  it("refuses to release when the delivery proof doesn't match the commitment", () => {
    const simulator = new BlindRouteSimulator(randomBytes(32), randomBytes(32));
    const commitment = simulator.commitmentOf(randomBytes(32));
    simulator.lockEscrow(1_000n, commitment);

    // simulate a courier guessing the wrong delivery-proof secret
    simulator.switchDeliveryProof(randomBytes(32));
    expect(() => simulator.releaseEscrow()).toThrow(
      "failed assert: Delivery proof does not match commitment",
    );
  });

  it("won't release an escrow twice", () => {
    const simulator = new BlindRouteSimulator(randomBytes(32), randomBytes(32));
    const commitment = simulator.commitmentOf(simulator.getPrivateState().deliveryProofSecret);
    simulator.lockEscrow(1_000n, commitment);
    simulator.releaseEscrow();
    expect(() => simulator.releaseEscrow()).toThrow(
      "failed assert: No active escrow to release",
    );
  });

  it("keeps private state untouched by public circuit calls", () => {
    const simulator = new BlindRouteSimulator(randomBytes(32), randomBytes(32));
    const initialPrivateState = simulator.getPrivateState();
    const commitment = simulator.commitmentOf(initialPrivateState.deliveryProofSecret);
    simulator.lockEscrow(1_000n, commitment);
    simulator.releaseEscrow();
    expect(simulator.getPrivateState()).toEqual(initialPrivateState);
  });
});
