---
name: BlindRoute Protocol
colors:
  surface: '#10141a'
  surface-dim: '#10141a'
  surface-bright: '#353940'
  surface-container-lowest: '#0a0e14'
  surface-container-low: '#181c22'
  surface-container: '#1c2026'
  surface-container-high: '#262a31'
  surface-container-highest: '#31353c'
  on-surface: '#dfe2eb'
  on-surface-variant: '#bbcabe'
  inverse-surface: '#dfe2eb'
  inverse-on-surface: '#2d3137'
  outline: '#859489'
  outline-variant: '#3c4a41'
  surface-tint: '#42e09a'
  primary: '#61f9b1'
  on-primary: '#003822'
  primary-container: '#3ddc97'
  on-primary-container: '#005c3a'
  inverse-primary: '#006c45'
  secondary: '#d7baff'
  on-secondary: '#440088'
  secondary-container: '#5f27a7'
  on-secondary-container: '#cca8ff'
  tertiary: '#ffd4e0'
  on-tertiary: '#640036'
  tertiary-container: '#ffabc7'
  on-tertiary-container: '#9e0558'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#65fdb5'
  primary-fixed-dim: '#42e09a'
  on-primary-fixed: '#002112'
  on-primary-fixed-variant: '#005233'
  secondary-fixed: '#eddcff'
  secondary-fixed-dim: '#d7baff'
  on-secondary-fixed: '#280056'
  on-secondary-fixed-variant: '#5c24a4'
  tertiary-fixed: '#ffd9e3'
  tertiary-fixed-dim: '#ffb0ca'
  on-tertiary-fixed: '#3e001f'
  on-tertiary-fixed-variant: '#8d004e'
  background: '#10141a'
  on-background: '#dfe2eb'
  surface-variant: '#31353c'
  public-zone: '#3DDC97'
  private-zone: '#B37FFF'
  private-accent: '#FF5FA3'
  surface-base: '#0A0E14'
  surface-elevated: '#121820'
  surface-highest: '#1C232D'
  text-muted: '#8A919E'
  error-red: '#FF4D4D'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  crypto-code:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: -0.01em
  crypto-lg:
    fontFamily: JetBrains Mono
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 24px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.08em
  headline-md-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 64px
  max-width-stage: 800px
---

## Brand & Style

The design system for the protocol centers on the "Control Room at Night" narrative—a cinematic, high-stakes environment characterized by confidence, quietude, and extreme technical precision. The brand personality is authoritative yet invisible, acting as a silent guardian for cryptographic secrets.

The target audience consists of privacy-conscious users and developers who value verification over trust. The emotional response should be one of "calm security"—the feeling of operating a sophisticated piece of machinery where every action is deliberate and every secret is mathematically shielded.

### Design Style: Modern Technical Minimalism
This system utilizes a **Minimalist** approach with a **Technical** overlay. 
- **Quiet Surface Hierarchy:** Instead of borders, we use tonal layering with subtle elevation to separate functional zones.
- **Visual Split (Public vs. Private):** A fundamental architectural rule where "everyone can see" elements (Public) are strictly separated from "browser-only" elements (Private) through color temperature and spatial placement.
- **Cinematic Restraint:** We avoid trendy glassmorphism or playful gradients. The UI remains dark and focused, using generous whitespace (dark space) to allow cryptographic values to breathe.

## Colors

The palette is anchored in a near-black charcoal (`#0A0E14`) to evoke the "night" atmosphere. Color is used functionally, not decoratively, to signal the state of data privacy.

- **Public Zone (Calm Teal/Green):** Used for the ledger state, verified transactions, and anything written to the blockchain. This signifies "The Truth" as seen by the world.
- **Private Zone (Electric Violet/Magenta):** Used exclusively for local browser states, proof generation, and secret management. This signifies "The Secret" held only by the user.
- **Functional Logic:** Never mix these two colors on a single component. If a button initiates a private proof to update a public state, the button remains in the Private color until the transaction is broadcast, at which point the success state shifts to the Public color.

## Typography

The typography system employs a dual-font strategy to differentiate between human-readable intent and machine-verifiable data.

- **Primary Sans (Hanken Grotesk):** Used for UI copy, instructions, and headers. It is approachable but clean, ensuring the app feels like a modern utility rather than a terminal.
- **Technical Mono (JetBrains Mono):** Used for all cryptographic values, hashes, addresses, and status labels. This provides the "built by experts" feel and ensures that long strings of data are highly legible and distinct from instructional text.
- **Hierarchy Rule:** Use `label-caps` in the Public/Private accent colors to categorize data types immediately.

## Layout & Spacing

The layout follows a **Focused Stage** model. Instead of showing all steps simultaneously, the UI highlights a single active operation while compressing completed steps into a summary header.

- **The Stage:** A centered column (max 800px) that contains the primary action. This maintains focus during the sensitive cryptographic proof process.
- **Split Hierarchy:**
    - **Top:** Global status and progress tracking.
    - **Center (The Stage):** Current functional step.
    - **Bottom/Drawer:** Persistent "Ledger State" (Public) and "Private Session" (Private) readouts.
- **Rhythm:** Use generous vertical spacing (32px+) between conceptual blocks to avoid a "cluttered form" feel. 
- **Breakpoints:**
    - **Mobile (<768px):** Single column, margins reduced to 16px, stacked step tracker.
    - **Desktop (>768px):** Centered stage, horizontal step tracker, fixed bottom utility cards.

## Elevation & Depth

Visual hierarchy is achieved through **Tonal Layering** and **Subtle Glows** rather than borders. 

- **Background:** The base layer is `#0A0E14`.
- **Primary Cards:** Use a slightly lighter shade (`#121820`) with a very soft, large-radius shadow (`box-shadow: 0 20px 40px rgba(0,0,0,0.4)`).
- **Active Accents:** When a process is running (like proof generation), the card associated with that zone (Public or Private) should emit a very faint, low-opacity outer glow in its respective accent color (`#3DDC97` or `#B37FFF` at 10% opacity).
- **Separation:** Use 2px vertical "pills" or indicators next to active content instead of full-box outlines.

## Shapes

The design system uses a **Soft (0.25rem)** roundedness profile to maintain a serious, industrial feel while remaining modern.

- **Base Elements:** 4px radius (buttons, inputs, small cards).
- **Large Containers:** 8px radius (The primary "Stage" card).
- **Status Pills:** Fully rounded (pill-shaped) for status indicators like "Connected" or "Network."
- **Interactive States:** On hover, buttons do not change shape but may increase in brightness or trigger a subtle scale effect (1.02x).

## Components

### Buttons
- **Action Buttons:** Large, solid backgrounds using the zone-specific color. For Private actions (e.g., "Generate Proof"), use the Electric Violet. For Public actions (e.g., "Broadcast Transaction"), use the Calm Teal.
- **Ghost Buttons:** Monospace text with a subtle underline or a 1px ghost border, used for secondary actions like "View Log."

### The Step Tracker
- Horizontal sequence of nodes. 
- **Completed:** Solid circle with a checkmark in Public Teal.
- **Active:** Pulsing ring in the color of the current zone.
- **Pending:** Dimmed grey text, no glow.

### Ledger & Private Cards
- **Ledger State Card:** Always uses the Public accent for labels. Monospace values. Content should appear as a structured list of key-value pairs, not a JSON blob.
- **Private Session Drawer:** Collapsed by default. Uses a "Locked" icon. Uses the Private accent for all indicators. If a value is hidden, show a series of dots or a "Stored Locally" badge rather than an empty space.

### Progress Indicators (The "Prover")
- For proof generation, use a horizontal linear progress bar that pulses with the Private accent color. 
- Include a technical label: "GENERATING ZK-PROOF LOCALLY..." to inform the user that the delay is functional, not a bug.

### Activity Log
- A slide-out panel from the right or bottom. 
- High-contrast Monospace text on a darker black background. 
- Differentiates "System" logs (white) from "Network" logs (Public Teal).