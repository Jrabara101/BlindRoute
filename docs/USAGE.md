# How to Use BlindRoute

BlindRoute is a privacy-preserving escrow: a customer locks a payment, and a courier
unlocks it by proving — without revealing — that they know the secret behind it.

## What You Need

- The [Lace wallet](https://chromewebstore.google.com/detail/lace/gafhhkghbfjjkeiendhlofajokpaflmk) browser extension, installed and set to the **Preview** network
- Some test funds in that Lace wallet from the [Preview faucet](https://faucet.preview.midnight.network/)
- A Chromium-based browser (Chrome, Brave, Edge) with only Lace active as your Midnight wallet extension — having a second Midnight-wallet extension enabled at the same time can cause a "wallet not found" error
- The BlindRoute app open in your browser (the [live demo](https://blindroute-web.pages.dev/), or your own local copy — see the main [README](../README.md))

You do **not** need to install anything else, run a node, or write any code to use the app.

## Step-by-Step Guide

1. **Open the app** and click **Connect Lace wallet**. Lace will pop up asking you to authorize the connection — approve it.
   - If Lace is set to a network other than Preview, the app will tell you and ask you to switch it in Lace's own settings, then reconnect.

2. **Get a contract to talk to.** You have two options:
   - **Deploy new contract** — creates a brand-new, empty escrow. You'll get a contract address back; save it if you want to share this escrow with someone else.
   - **Join contract** — paste in an existing escrow's contract address (for example, one someone else deployed) to connect to it instead.

3. **Lock the escrow (as the customer).** Enter the payment amount you want to lock and click **Lock escrow (customer)**. Lace will prompt you to prove, sign, and submit the transaction — approve each prompt. Once it's confirmed, the escrow's status changes to `LOCKED` and the amount plus a commitment (a hash, not the secret itself) become visible on-chain.

4. **Release the escrow (as the courier).** When the delivery condition is met, click **Release escrow (courier)**. This is the zero-knowledge step: the app proves, entirely in your browser, that it knows the secret behind the commitment from step 3 — without ever sending that secret anywhere. Approve Lace's prompts again. This step is slower than locking (the proof is bigger), so expect it to take longer.

5. **Watch the status update.** The on-screen ledger-state panel and the activity log update as each transaction confirms — `EMPTY` → `LOCKED` → `RELEASED`. At no point does the delivery secret appear in the log, the UI, or anywhere else.

## What Gets Proved (and What Stays Private)

| | Public (anyone can see on-chain) | Private (never leaves your browser) |
|---|---|---|
| What | Escrow status, payment amount, the commitment hash, the courier's derived public key, transaction IDs | The delivery-proof secret, the courier's identity secret key |
| Why | So anyone can independently verify the escrow was locked and later released correctly | This is exactly the data BlindRoute exists to keep off the public ledger |

When the courier releases the escrow, the network confirms — via a zero-knowledge proof — that they genuinely knew the secret behind the original commitment. It does **not** learn what that secret was, or who the courier is in real life. All it sees is: a valid proof, and a public key that was used to submit it.

## Troubleshooting

- **"Wallet not found" or the Connect button does nothing** — Disable any other Midnight-wallet browser extension so Lace is the only one active, then reload the page.
- **Nothing happens after clicking Lock/Release and no Lace popup appears** — Your browser's popup blocker is likely eating Lace's confirmation window. Allow popups for this site and try again.
- **"cancelled by user" error** — You (or an accidental click) dismissed a Lace prompt. Just retry the action.
- **"Insufficient funds: dust" error** — Your wallet has NIGHT but hasn't registered it for DUST generation yet, which is needed to pay for transactions. Use Lace's dust-designation action, wait a bit for it to accumulate, then retry.
- **Release feels stuck / much slower than Lock** — This is expected. The release proof is significantly larger than the lock proof, so local proof generation takes noticeably longer. Give it time before assuming it's frozen.
- **App says Lace is on the wrong network** — Open Lace's settings and switch the active network to **Preview**, then reconnect from the app.
