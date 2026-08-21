# Product Proposal

**Idea category:** Private Payroll / Splits — *distribute funds without exposing amounts [or the condition that releases them]*
**Submission category (Level 4-6 idea submission):** Payments

## What is the product, and who uses it?

BlindRoute is a privacy-preserving escrow for conditional, two-party fund release. A **payer** (customer) locks a payment on-chain against a public commitment to a private release condition — a delivery-proof secret, standing in for whatever real-world event should unlock the funds (a signed delivery confirmation, a GPS drop-off attestation, a recipient's signature). A **payee** (courier) unlocks the payment by proving, in zero knowledge, that they hold the secret behind that commitment, without ever disclosing the secret — or the real-world identity behind their claim — on-chain.

This generalizes directly to payroll/split-payment use cases: a DAO or marketplace escrowing a milestone payment, a gig platform releasing pay on private proof of task completion, or a two-party split where the release condition (a delivery, a signed approval, a completed task) should stay off the public record even though the *fact* that funds moved, and how much, is fine to disclose.

Target users: two-party or small-group transacting parties (marketplaces, logistics/gig platforms, DAOs paying contributors) who need public accountability that a payment happened and was correctly conditioned, but do not want the condition itself — often personal or operationally sensitive data — permanently public.

## Why Midnight specifically?

A transparent chain forces a binary choice: either publish the release condition on-chain (a delivery code, a GPS ping, a recipient's signature) so anyone can verify the release was legitimate — which turns the ledger into a permanent, public log of exactly when and how someone received a payment and what private data justified it — or keep the condition off-chain entirely and trust a centralized intermediary to attest that it was met, which reintroduces the single point of failure and the data-breach risk decentralization was supposed to remove.

Midnight's selective-disclosure model resolves this without either compromise. The contract's public ledger state (`state`, `amount`, `deliveryCommitment`, `courier`, `sequence`) gives any observer everything needed to verify the escrow behaved correctly: an amount was locked, and it was later released to a specific (pseudonymous) claimant who *proved* — via a zero-knowledge circuit, not a self-report — that they knew the secret behind the originally published commitment. What never appears on-chain is the secret itself or any link between the courier's derived public key and a real-world identity. No other party, including the chain itself, ever sees the private witness data (`localSecretKey`, `deliveryProof`) — it's generated and consumed entirely client-side, and only the resulting proof is submitted. This is exactly the gap a transparent EVM/UTXO chain can't close: verifiable correctness *and* confidential inputs, at the same time, with no trusted third party in between.

## Data Model

| Data Point                                  | Type            | Disclosed To |
|----------------------------------------------|-----------------|--------------|
| Escrow state (`EMPTY` / `LOCKED` / `RELEASED`) | Public ledger   | Everyone |
| Payment amount                                | Public ledger   | Everyone |
| Delivery commitment (hash of the secret)      | Public ledger   | Everyone |
| Courier's derived public key                  | Public ledger   | Everyone (pseudonymous — not linkable to a real identity) |
| Escrow sequence number                        | Public ledger   | Everyone |
| Zero-knowledge proof of correct release       | Public (per-tx) | Everyone (proves validity, discloses nothing about the witness) |
| Delivery-proof secret (the release condition) | Private witness | No one — never leaves the caller's device/browser session |
| Courier's identity secret key                 | Private witness | No one — never leaves the caller's device/browser session |

## Mainnet Feasibility

Yes, this is realistic to reach Mainnet by Level 6, with scope growing incrementally rather than requiring a redesign:

- **Now (Level 2–3):** single-escrow contract, one payer/payee pair, browser-driven via Lace, proofs generated client-side. This already demonstrates the full selective-disclosure pattern end-to-end.
- **Near-term (Level 4–5):** generalize from one escrow per contract instance to a keyed/multi-escrow registry (many concurrent payer/payee pairs sharing one deployed contract), add a dispute/timeout/refund path (payer reclaims funds if the condition is never met), and replace the placeholder "delivery-proof secret" with a real attestation source (e.g., a signed message from a delivery/logistics API or an oracle) so the commitment corresponds to a verifiable real-world event rather than an arbitrary shared secret.
- **Mainnet-track concerns:** proving time for `releaseEscrow` (currently the larger of the two circuits) needs to stay usable on real hardware/wallets at scale; multi-escrow state growth needs a sensible on-chain indexing strategy; and the trust model for *how* the off-chain condition (delivery, task completion, milestone) is attested needs to be pluggable rather than hard-coded, so the same contract pattern can serve logistics, gig-work payroll, and DAO milestone payments without redeployment. None of these are blocking — they're incremental hardening of a pattern that already works.

## Level 4-6 Idea Submission

**What is the idea?** Scale BlindRoute from a single-escrow proof of concept into a multi-party private payroll/splits system, while keeping the same privacy guarantee: amounts and the fact that a release occurred stay public and auditable, but *who* was paid for *what specific private reason* never does. Three concrete additions carry the contract from Level 2-3 to Level 4-6:

1. **Multi-party registry.** Replace the single global `state`/`amount`/`deliveryCommitment` ledger fields with a keyed registry (escrow ID → record), so one deployed contract supports many concurrent payer/payee pairs instead of one escrow per deployment — the difference between a demo and an actual payroll system.
2. **Dispute / timeout / refund path — implemented at Level 5.** Added a self-contained tick counter (`clock`) and a `refundEscrow` circuit: at lock time the payer sets a refund deadline (in ticks); once the shared clock has advanced past it, only the original payer (proven the same way courier identity is — via a derived public key, not a password) can reclaim the locked funds. Closes the gap where funds would otherwise lock permanently if the payee never claims them. See `contract/src/blindroute.compact` and `docs/USAGE.md`.
3. **Pluggable attestation source.** Replace the placeholder shared-secret commitment with a real verifiable attestation — a signed milestone confirmation, a delivery/logistics API signature, or an oracle-fed proof — so `commitmentOf` binds to an actual verifiable real-world event rather than an arbitrary pre-agreed secret.

**Why this stays a Midnight problem, not just a bigger Solidity contract:** a transparent chain can implement a multi-party escrow registry trivially, but only by publishing every release condition and every payee's claim data permanently on-chain. Midnight's selective disclosure is what lets the registry scale in *volume* (many escrows, many parties) without scaling in *disclosure* — the ZK proof obligation on each release stays the same regardless of how many other parties are using the same deployed contract.
