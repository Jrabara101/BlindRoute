# BlindRoute Preview Tester Feedback — Google Form Spec

Paste this into a new Google Form (forms.google.com → Blank form). Field order,
types, and options are laid out exactly as they should appear in the form.
Once created, link it from `docs/OUTREACH.md` messages and from the app itself,
and paste the live form URL into `docs/FEEDBACK.md` § Feedback Collection Method.

---

**Form title:** BlindRoute Preview Feedback (Midnight Testnet)

**Form description:**
> Thanks for testing BlindRoute — a privacy-preserving delivery escrow on
> Midnight's Preview network. This takes ~2 minutes. Your wallet address is
> used only to credit you as a verified Preview tester (cross-checked against
> the Preview network explorer) — no personal data is collected.

---

## 1. Wallet address
- **Type:** Short answer
- **Required:** Yes
- **Validation:** none (self-reported; cross-checked manually against the
  explorer before adding to `USERS.md`)
- Help text: "The address you connected with in Lace (starts with `addr_test1...`)"

## 2. Which parts of the app did you try?
- **Type:** Checkboxes (multi-select)
- **Required:** Yes
- Options:
  - Connected wallet
  - Deployed a new contract
  - Joined an existing contract
  - Locked an escrow
  - Released an escrow (courier claim)
  - Triggered a refund / timeout path
  - Something didn't work / I got stuck

## 3. Rate how clear each step was (1 = very confusing, 5 = totally clear)
- **Type:** Multiple choice grid
- **Required:** No (allow skipping rows not attempted)
- Rows:
  - Connecting wallet
  - Deploying/joining contract
  - Locking escrow
  - Releasing escrow
  - Refund/timeout flow
- Columns: 1, 2, 3, 4, 5

## 4. Did anything break or behave unexpectedly?
- **Type:** Paragraph
- **Required:** No
- Help text: "What happened, what you expected instead, and what
  browser/wallet version you used, if it broke. Leave blank if nothing broke."

## 5. What confused you most, if anything?
- **Type:** Paragraph
- **Required:** No
- Help text: "Even something small — an unclear label, a step that felt
  unexplained — is genuinely useful."

## 6. Would you trust this for a real payment (not testnet)?
- **Type:** Multiple choice
- **Required:** Yes
- Options:
  - Yes
  - No
  - Not sure
- Followed by:

## 6a. Why / why not?
- **Type:** Paragraph
- **Required:** No

## 7. Anything else you'd want to see added or changed?
- **Type:** Paragraph
- **Required:** No

---

## After creating the form

1. Click **Send** → copy the shareable link (short `forms.gle/...` link).
2. Add that link to:
   - `docs/OUTREACH.md` — append "or fill out this 2-min form: [link]" to each
     message template.
   - `docs/FEEDBACK.md` § Feedback Collection Method — replace the TBD note
     with the link and a one-line description.
   - The web app itself — a small "Give feedback" link in the footer or the
     activity-log drawer (optional but raises response rate).
3. Turn on **Responses → Get email notifications for new responses** in the
   form's Responses tab, so you don't have to poll it manually.
4. Link the response spreadsheet (Responses → green Sheets icon) — that sheet
   becomes your working copy; periodically fold entries into `docs/FEEDBACK.md`
   § Raw Feedback Log and § What We Heard (Themes) as patterns emerge.
