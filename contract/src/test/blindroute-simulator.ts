import {
  type CircuitContext,
  QueryContext,
  sampleContractAddress,
  convertFieldToBytes,
  createConstructorContext,
  CostModel,
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  type Ledger,
  ledger,
} from "../managed/blindroute/contract/index.js";
import { type BlindRoutePrivateState, witnesses } from "../witnesses.js";

/**
 * Serves as a testbed to exercise the BlindRoute escrow contract in tests,
 * without needing a running node, indexer, or proof server.
 */
export class BlindRouteSimulator {
  readonly contract: Contract<BlindRoutePrivateState>;
  circuitContext: CircuitContext<BlindRoutePrivateState>;

  constructor(secretKey: Uint8Array, deliveryProofSecret: Uint8Array) {
    this.contract = new Contract<BlindRoutePrivateState>(witnesses);
    const {
      currentPrivateState,
      currentContractState,
      currentZswapLocalState,
    } = this.contract.initialState(
      createConstructorContext({ secretKey, deliveryProofSecret }, "0".repeat(64)),
    );
    this.circuitContext = {
      currentPrivateState,
      currentZswapLocalState,
      costModel: CostModel.initialCostModel(),
      currentQueryContext: new QueryContext(
        currentContractState.data,
        sampleContractAddress(),
      ),
    };
  }

  /** Switch to a different courier's secret key, e.g. to simulate a second party. */
  public switchCourier(secretKey: Uint8Array) {
    this.circuitContext.currentPrivateState = {
      ...this.circuitContext.currentPrivateState,
      secretKey,
    };
  }

  /** Replace the delivery-proof secret this party knows, e.g. a wrong guess. */
  public switchDeliveryProof(deliveryProofSecret: Uint8Array) {
    this.circuitContext.currentPrivateState = {
      ...this.circuitContext.currentPrivateState,
      deliveryProofSecret,
    };
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public getPrivateState(): BlindRoutePrivateState {
    return this.circuitContext.currentPrivateState;
  }

  /** Compute the public commitment for a delivery-proof secret (pure, no ledger mutation). */
  public commitmentOf(proof: Uint8Array): Uint8Array {
    return this.contract.circuits.commitmentOf(this.circuitContext, proof).result;
  }

  public lockEscrow(paymentAmount: bigint, commitment: Uint8Array): Ledger {
    this.circuitContext = this.contract.impureCircuits.lockEscrow(
      this.circuitContext,
      paymentAmount,
      commitment,
    ).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public releaseEscrow(): Ledger {
    this.circuitContext = this.contract.impureCircuits.releaseEscrow(
      this.circuitContext,
    ).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public courierPublicKey(): Uint8Array {
    const sequence = convertFieldToBytes(
      32,
      this.getLedger().sequence,
      "blindroute-simulator.ts",
    );
    return this.contract.circuits.publicKey(
      this.circuitContext,
      this.getPrivateState().secretKey,
      sequence,
    ).result;
  }
}
