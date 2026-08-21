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

    // releaseEscrow derives the courier key from the sequence *before*
    // incrementing it, so the expected key must be captured beforehand.
    const expectedCourierKey = simulator.partyPublicKey();
    const ledgerState = simulator.releaseEscrow();
    expect(ledgerState.state).toEqual(EscrowState.RELEASED);
    expect(ledgerState.courier).toEqual(expectedCourierKey);
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

  it("refuses to refund a locked escrow before its deadline has passed", () => {
    const simulator = new BlindRouteSimulator(randomBytes(32), randomBytes(32));
    const commitment = simulator.commitmentOf(simulator.getPrivateState().deliveryProofSecret);
    simulator.lockEscrow(1_000n, commitment, 3n);
    simulator.tick();
    simulator.tick();
    expect(() => simulator.refundEscrow()).toThrow(
      "failed assert: Refund deadline has not passed yet",
    );
  });

  it("lets the original payer reclaim funds once the refund deadline passes", () => {
    const simulator = new BlindRouteSimulator(randomBytes(32), randomBytes(32));
    const commitment = simulator.commitmentOf(simulator.getPrivateState().deliveryProofSecret);
    simulator.lockEscrow(1_000n, commitment, 2n);
    simulator.tick();
    simulator.tick();

    const ledgerState = simulator.refundEscrow();
    expect(ledgerState.state).toEqual(EscrowState.EMPTY);
    expect(ledgerState.amount).toEqual(0n);
  });

  it("refuses to refund an escrow that isn't locked", () => {
    const simulator = new BlindRouteSimulator(randomBytes(32), randomBytes(32));
    expect(() => simulator.refundEscrow()).toThrow(
      "failed assert: No active escrow to refund",
    );
  });

  it("refuses to let a party other than the original payer claim the refund", () => {
    const simulator = new BlindRouteSimulator(randomBytes(32), randomBytes(32));
    const commitment = simulator.commitmentOf(simulator.getPrivateState().deliveryProofSecret);
    simulator.lockEscrow(1_000n, commitment, 1n);
    simulator.tick();

    // a different party (e.g. the courier, or an unrelated caller) tries to claim the refund
    simulator.switchCourier(randomBytes(32));
    expect(() => simulator.refundEscrow()).toThrow(
      "failed assert: Only the original payer can reclaim this escrow",
    );
  });

  it("allows a new escrow to be locked after a refund", () => {
    const simulator = new BlindRouteSimulator(randomBytes(32), randomBytes(32));
    const commitment = simulator.commitmentOf(simulator.getPrivateState().deliveryProofSecret);
    simulator.lockEscrow(1_000n, commitment, 1n);
    simulator.tick();
    simulator.refundEscrow();

    const newCommitment = simulator.commitmentOf(simulator.getPrivateState().deliveryProofSecret);
    const ledgerState = simulator.lockEscrow(2_000n, newCommitment);
    expect(ledgerState.state).toEqual(EscrowState.LOCKED);
    expect(ledgerState.amount).toEqual(2_000n);
  });

  it("cannot release an escrow after it has been refunded", () => {
    const simulator = new BlindRouteSimulator(randomBytes(32), randomBytes(32));
    const commitment = simulator.commitmentOf(simulator.getPrivateState().deliveryProofSecret);
    simulator.lockEscrow(1_000n, commitment, 1n);
    simulator.tick();
    simulator.refundEscrow();
    expect(() => simulator.releaseEscrow()).toThrow(
      "failed assert: No active escrow to release",
    );
  });
});
