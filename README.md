# BlindRoute

> Privacy-preserving delivery escrow on [Midnight](https://midnight.network) — a courier proves delivery in zero knowledge, without the ledger ever learning what that proof was.

## Live Demo

[PASTE LIVE URL AFTER DEPLOYING WITH WRANGLER]

## Contract Address

| Network | Address |
|---------|---------|
| Preprod | `[PASTE PREPROD CONTRACT ADDRESS]` |
| Preview (Level 1) | `e7ceb9e25fb84d63f68ffc55b9a4ce2dbe2e7a69873568a901ff86b3d1016ba7` |

## What This Does

In traditional e-commerce and Web3 logistics, tracking a delivery to unlock escrowed funds creates a data privacy vulnerability: public blockchains require publishing tracking numbers, delivery hashes, or courier receipts on-chain, exposing a customer's purchasing habits and transactional metadata to anyone reading the ledger, while centralized logistics providers cache unencrypted address data that becomes a breach target.

BlindRoute resolves this by separating verification from visibility:

- A **customer** locks a payment escrow on-chain, publishing only the amount and a public *commitment* (a hash) of a private delivery-proof secret.
- A **courier** releases the escrow by proving, in zero knowledge, that they know the secret behind that commitment — without the secret (or whatever real-world proof it stands in for: a GPS ping, a recipient signature, a drop-off code) ever touching the ledger.

The frontend in `web/` connects to the Lace wallet via the Midnight DApp Connector API, deploys or joins the contract on Preprod, and calls both circuits directly from the browser — proofs are generated locally, and only the resulting transaction is submitted on-chain.

## Privacy Model

| | Public ledger state | Private witness |
|---|---|---|
| What | `state` (EMPTY/LOCKED/RELEASED), `amount`, `deliveryCommitment` (a hash), `courier` (a derived public key), `sequence` | `localSecretKey` (courier's identity secret), `deliveryProof` (the secret behind the commitment) |
| Who sees it | Anyone reading the chain, or the app UI | Only this browser tab, in memory, for the current session |
| Why | The escrow's existence, amount, and current status need to be publicly verifiable so either party (or the network) can confirm the contract behaved correctly | The actual proof of delivery — and the courier's real-world identity — is exactly the data this contract exists to keep off the ledger |

- **PUBLIC:** escrow state, payment amount, the delivery commitment hash, the courier's derived public key, all transaction IDs.
- **PRIVATE:** the delivery-proof secret and the courier's identity secret key — generated in the browser, held only in an in-memory private-state provider, never sent to any server or wallet call, never rendered in the UI.
- **PROVEN WITHOUT REVEALING:** that the caller in `releaseEscrow()` knows a value that hashes to the commitment recorded when the escrow was locked — the value itself is never disclosed.

## Privacy Claim

An on-chain observer watching this contract sees: an escrow appear with a payment amount and a commitment hash, then later flip to `RELEASED` alongside a courier public key and a valid zero-knowledge proof. What that observer **cannot** see, at any point: the delivery-proof secret (the drop-off code / GPS ping / signature it stands in for), or any link between the courier's derived public key and their real-world identity. The app's UI enforces the same boundary — `web/src/main.ts` never assigns the private secret to any DOM element or log line; only the public commitment hash and transaction results are ever displayed.

## Tech Stack

Midnight network, [Compact](https://docs.midnight.network/relnotes/compact), Midnight.js SDK, Midnight DApp Connector API, Vite + TypeScript, Lace wallet, Cloudflare Pages (Wrangler).

## Prerequisites

- [Lace wallet](https://chromewebstore.google.com/detail/lace/gafhhkghbfjjkeiendhlofajokpaflmk) browser extension, configured for the **Preprod** network, with test funds from the [Preprod faucet](https://faucet.preprod.midnight.network/)
- Node.js 20+ (Compact's own toolchain needs WSL/Linux/macOS — see below — but the `web/` frontend itself runs fine on any platform once `contract/` is built)
- [WSL + Ubuntu](https://docs.midnight.network/guides/windows-compact-setup) (Windows only, for the Compact compiler / `contract` build step)
- [Docker](https://www.docker.com/products/docker-desktop/) (optional — only needed if your wallet build doesn't support `getProvingProvider()` and the app falls back to a local proof server)

## Run Locally

```bash
git clone <this-repo-url>
cd BlindRoute
npm install

# Build the compiled contract package the CLI and web app both import
cd contract
npm run build
cd ..

# Run the frontend
cd web
npm run dev
```

Open the printed local URL, then:

1. Click **Connect Lace wallet** and authorize the connection. (Lace must be set to the Preprod network — see [Privacy Model](#privacy-model) note above.)
2. Click **Deploy new contract** (or paste an existing Preprod address into **Join contract**).
3. Enter a payment amount and click **Lock escrow (customer)** — approve the Lace prove/sign/submit prompts.
4. Click **Release escrow (courier)** — this is the zero-knowledge step: watch the log and the ledger-state panel update to `RELEASED` without the delivery secret ever appearing anywhere on screen.

**Known snags and fixes:**
- Wallet-detection error on deploy → disable any other Midnight-wallet browser extension so only Lace is active.
- "cancelled by user" with no popup ever shown → your browser's popup blocker is eating Lace's confirmation window; allow popups for the app's origin and retry.
- "Insufficient funds: dust" → the wallet needs its NIGHT registered for DUST generation first; use Lace's dust-designation action and wait for it to accumulate.
- Release feels stuck → `releaseEscrow`'s proving key is ~5MB (vs. ~150KB for `lockEscrow`), so local proof generation is noticeably slower. This is expected.

### Deploy the frontend (Cloudflare Pages via Wrangler)

```bash
cd web
npx wrangler login        # first time only
npm run deploy            # builds, then `wrangler pages deploy`
```

### CLI (alternate deploy path)

A Node.js CLI in `cli/` also deploys/drives the contract, documented for completeness:

```bash
cd cli
npm run preprod-ps   # or: npm run preview-ps
```

Its own wallet sync currently hits a bug in the installed `wallet-sdk-facade` version (sync progress never advances past zero while leaking memory). The browser app in `web/` sidesteps this by delegating wallet sync, balancing, signing, and proving to Lace instead of our own wallet code.

## Repository Layout

```
contract/            Compact contract, TypeScript witnesses, unit tests
  src/blindroute.compact
  src/witnesses.ts
  src/test/           Simulator-based unit tests (vitest, no network needed)
  src/managed/        Generated by `compact compile` — circuits + keys
cli/                  Node.js CLI: deploy and drive the contract on Preview/Preprod
web/                  Browser app: Lace wallet connect/disconnect, deploy/join,
                       and lockEscrow/releaseEscrow circuit calls
  src/wallet.ts        Lace connection, network-mismatch/rejection handling
  src/contract.ts      Providers wiring, deploy/join, circuit calls
  src/main.ts          DOM wiring
```

## Demo Video

[PLACEHOLDER — link added after recording]

## Status

Level 2 (First Light): contract wired to a real frontend, Lace connected on Preprod, `lockEscrow`/`releaseEscrow` called directly from the browser with proofs generated locally. Multi-party lock/release flows (separate customer and courier wallets/sessions) and a real delivery-proof source (e.g. signed GPS attestations) remain planned for later milestones.
