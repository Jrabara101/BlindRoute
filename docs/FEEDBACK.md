# User Feedback — Level 5

## Feedback Collection Method

A Google Form linked from every outreach message (Discord/Telegram/X, see
[OUTREACH.md](./OUTREACH.md)) and from a **Feedback** button in the app's top
bar — plus direct DMs from testers who prefer that. See
[FEEDBACK_FORM.md](./FEEDBACK_FORM.md) for the exact field spec used to build
it.

The form also opens automatically, once per session, the first time a tester
successfully releases an escrow — the natural "I just finished the golden
path" moment (see `web/src/main.ts`'s `maybeAutoOpenFeedback`).

**Live form link:** https://forms.gle/6oSenWAdL55RkkPa8

## Raw Feedback Log

| # | User | Feedback Summary | Date |
|---|------|-------------------|------|
| 1 | First Preview tester | (1) Favicon 404 — no favicon was configured at all. (2) Tailwind CDN production warning in console (cdn.tailwindcss.com). (3) "Core UI crash" during transaction submission — no error text/screenshot provided. | 2026-09-13 |

## What We Heard (Themes)

- **Console hygiene matters even when the app "works"** — a 404'd favicon
  and a dev-only CDN warning don't block usage, but they read as
  unfinished/unpolished to anyone who opens devtools, which testers
  evaluating a builder-challenge submission are likely to do.
- **Multi-wallet-extension conflicts are a real risk, not just a
  theoretical one** — this app was only ever built/tested against Lace,
  but nothing stopped it from silently trying to drive a different
  injected Midnight wallet (e.g. 1am wallet) if one was also installed.

## What We Changed

| Change | Reason | Commit |
|--------|--------|--------|
| Added a favicon (inline SVG data URI) | Fix tester-reported 404 | bedeca8 |
| Migrated Tailwind from the play CDN to a real build-time setup (`@tailwindcss/vite`) | Fix tester-reported production console warning | bedeca8 |
| Split transaction-call error handling from post-success ledger-refresh error handling in `main.ts` | A ledger-refresh failure (indexer lag, network blip) right after a successful lock/release/tick/refund was being reported as if the transaction itself had failed, showing the error screen even though funds were already moved on-chain — a very plausible cause of the reported "crash" | bedeca8 |
| Added `selectWallet()` in `wallet.ts` to specifically pick Lace by name instead of blindly using `window.midnight`'s first entry, with a clear error if a non-Lace wallet responds instead | If a tester has more than one Midnight wallet extension installed (e.g. Lace + 1am wallet), whichever loaded first previously became "the" wallet silently, even though this app's provider wiring only handles Lace's API — a strong second candidate for the reported crash | bedeca8 |
