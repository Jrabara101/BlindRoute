# BlindRoute — Design Brief

This is a non-technical visual brief for redesigning the BlindRoute web app.
It's written to be pasted into Stitch (or handed to any designer) as a prompt.
It describes *what the app should feel like and how it should move*, not code.

Use it alongside `docs/USAGE.md` (what the user does) and the README's
"Privacy Model" section (what's public vs. private) — the design's whole job
is to make that public/private split *felt*, not just stated.

---

## 1. What This App Is, in One Sentence

A customer locks a payment in escrow; a courier unlocks it by proving —
without revealing — that they completed the delivery. The app is the visual
proof that a secret was used without ever showing the secret.

## 2. The One Idea the Whole Design Should Communicate

**Two zones: what everyone can see, and what only this browser can see.**

Every existing product in this space (Stripe, most crypto wallets, most
escrow apps) shows you *one* unified state. BlindRoute is different: it is
always showing you two states at once — a **public** ledger state anyone can
verify, and a **private** state that exists only in this tab, never
transmitted anywhere. The design should make that split the first thing a
visitor notices, before they read a word of copy.

Concretely: **public and private information should never share a visual
container.** They can sit side by side, but they need different color
temperature, different iconography, and ideally different physical
placement (e.g. public on the left/top, private on the right/bottom, or
public as the "stage" and private as a locked drawer).

## 3. Mood / Visual Direction

- **Dark, not light.** This is a privacy and cryptography product — think
  "control room at night," not "SaaS landing page." A near-black base
  (`#0A0E14`-ish charcoal, not pure black) with one saturated accent color
  reserved *only* for private/secret elements.
- **One accent color for "private," a different one for "public."** Suggest:
  a cold electric violet or magenta (`#B37FFF` / `#FF5FA3` range) for
  anything private/secret, and a calm teal or green (`#3DDC97` range) for
  anything public/verified. Never mix them on the same element — the color
  itself should tell the user which side of the boundary they're looking at.
- **Monospace for anything cryptographic** (hashes, addresses, tx IDs),
  humane sans-serif for everything else (labels, instructions, status text).
  This is a small detail that reads as "built by people who understand
  crypto" rather than "wrapped a contract in a form."
- **Generous whitespace, few borders.** Replace the current boxed
  `<section>` panels-with-borders look with soft elevation (subtle shadow or
  a barely-different background shade) instead of hard 1px lines everywhere.
- **Not playful. Not corporate-friendly-blue.** Confident, quiet, a little
  cinematic. Think "1Password meets a block explorer," not "typical Web3
  dashboard with neon gradients everywhere."

## 4. Layout — Reframe the Existing 3 Steps as a Journey

The current app is three stacked, equally-weighted `<section>` blocks:
Wallet → Contract → Escrow circuits, followed by a raw JSON dump and a raw
log. Keep the same three functional steps, but present them as a **guided,
left-to-right (or top-to-bottom on mobile) flow with a persistent progress
indicator**, not a form. Concretely:

1. **A slim top bar**: product name/wordmark, a small "Preview network"
   pill/badge, and the wallet connection status (address truncated,
   monospace, with a green "connected" dot).
2. **A horizontal step tracker** (Connect → Contract → Lock → Release) that
   visually advances as the user progresses — each step's icon fills in or
   lights up in the "public" accent color once complete. This replaces the
   current implicit ordering (buttons just enable/disable with no visual
   story) with an explicit one.
3. **One focused "stage" area** showing only the current step's action —
   not all three sections crammed onto the page at once. Completed steps
   collapse into a compact summary row (e.g. "✓ Connected as
   addr1q9f...3k2p") the user can still glance at, but that isn't competing
   for attention with the current step.
4. **A "Ledger State" card** (public accent color, monospace values) that's
   always visible once a contract is active — this is the "what everyone
   can see" anchor. It should feel like a real-time status readout, not a
   JSON dump: labeled fields (Status, Amount, Commitment, Courier Key) each
   in their own row rather than raw `JSON.stringify` text.
5. **A collapsed-by-default "Private session" drawer** (private accent
   color, lock icon) showing that private values exist without ever
   printing them — e.g. "🔒 Delivery secret: generated, held in this tab
   only" with no actual value shown. This is the visual proof of the
   privacy claim.
6. **The activity log** becomes a slide-out or bottom drawer, monospace,
   de-emphasized — useful for the technically curious, not part of the
   primary flow.

## 5. Animation & Motion — Specific Moments Worth Choreographing

Motion should always *mean something* — every animation on this list exists
to make a privacy/verification concept visible, not just to look nice.

1. **Wallet connect →** a short pulse/glow travels from the Connect button
   to the top-bar status pill as it turns from gray to "connected" green —
   communicates "this just became a live, verified session."
2. **Deploy/Join contract →** the step tracker's "Contract" node fills in
   with a brief draw-on animation (like a circuit trace lighting up), and
   the new "Ledger State" card fades/slides in from below. This is the
   moment the public side of the app becomes real — give it half a second
   of presence.
3. **Lock escrow (the key moment #1) →** when the commitment hash is
   generated, animate it as if the private secret (shown briefly as an
   abstract shape/glyph in the private accent color) passes through a
   "hashing" visual — a brief scramble/dissolve effect — and what lands in
   the public Ledger State card is only the resulting hash, now in the
   public accent color. This single animation *is* the product's core pitch
   made visible: private thing goes in, only a public commitment comes out.
4. **"Generating proof locally" states (both lock and especially release)
   →** replace the current plain "locking escrow... (generating proof
   locally)" text with a determinate-feeling but honest progress treatment
   — e.g. a slow pulsing progress bar or an animated waveform, in the
   private accent color, explicitly labeled "Proving in your browser — nothing
   is sent yet." Release is meaningfully slower than lock (larger proof) —
   the design should say so up front ("this one takes longer") rather than
   let the user wonder if it's frozen.
5. **Release success (the key moment #2) →** when `RELEASED` lands, animate
   a small proof-checkmark traveling from the (still-hidden) private drawer
   into the public Ledger State card, landing next to "Status: RELEASED."
   The private drawer never opens or reveals anything during this — that
   restraint *is* the point. Pair with a brief teal glow on the Ledger State
   card and a one-line confirmation: "Verified without revealing the
   secret."
6. **Step-tracker transitions** between all steps: simple 200–300ms
   ease-out fades/slides, nothing bouncy — this product's motion vocabulary
   is "precise and quiet," not "delightful and bubbly."
7. **Errors** (wallet rejection, insufficient dust, wrong network) → a
   short shake or red-edge flash on the relevant card, paired with the
   existing plain-English error copy — keep these calm, not alarming; this
   is a wallet-adjacent product and users are already anxious about money.

## 6. States to Design (don't skip these — they're most of the real UI)

- Disconnected / not connected
- Connecting (loading)
- Connected, no contract yet
- Deploying (loading, ~20–30s — needs its own patient-feeling state)
- Joining an existing contract (loading)
- Contract active, escrow EMPTY (ready to lock)
- Locking (loading, proof generation)
- Escrow LOCKED (ready to release) — this state should visually differ from
  EMPTY (e.g. the Ledger State card gains the commitment hash row)
- Releasing (loading, proof generation — slower, needs the "this takes
  longer" messaging from §5.4)
- Escrow RELEASED (terminal success state)
- Any error state (wallet rejected, wrong network, insufficient dust,
  double-lock/double-release guard failures) — see `docs/USAGE.md`
  Troubleshooting section for the actual list of errors to design for

## 7. What NOT to Do

- Don't hide or downplay the Preview-network badge — this is a testnet demo,
  say so plainly and calmly (a small pill, not a scary warning banner).
- Don't ever mock up or placeholder-render an actual secret/private value,
  even fake-looking ones — the whole point is that no UI should ever have a
  slot where that value could go. Locked/private states show *that* a value
  exists, never *what* it is.
- Don't use loading spinners with no context — every wait state in this app
  is a real cryptographic operation (local proof generation); label what's
  actually happening.
- Don't make it look like a generic Web3 dashboard template (heavy
  gradients, glassmorphism everywhere, neon on neon). The privacy-first
  positioning wants restraint.

## 8. Deliverables to Bring Back From Stitch

When exporting from Stitch for implementation, get:
- Full-page screens/mockups for each state in §6 (or at minimum:
  disconnected, contract-active/EMPTY, LOCKED, RELEASED, one error state)
- The two accent colors as hex values (public + private), plus the base
  dark background shade(s)
- Any icon choices used for lock/public/verified concepts, as SVG if
  possible
- Font pairing (sans for UI copy, monospace for crypto values) with
  weights used

These get handed back to translate into the existing Vite + TypeScript app
(`web/src/main.ts`, `web/index.html`) — no framework migration needed, this
is a styling/layout/motion pass on the existing DOM-driven app, not a
rewrite.
