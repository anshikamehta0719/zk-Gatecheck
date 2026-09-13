# How to Use Gatecheck

## What You Need

- A modern web browser (Chrome, Firefox, Brave, Edge, or Safari)
- If you're an **issuer** (running an allowlist): a list of people you want to admit — email addresses, wallet addresses, whatever you use internally. Gatecheck never sees or stores this list; you keep it.
- If you're a **member** (proving you belong): a private "secret" the issuer gives you, or one the demo generates for you to try the flow yourself.
- No crypto wallet is required to try the local demo. A Midnight-compatible wallet (Lace) is only needed for a real, on-chain deployment.

## Step-by-Step Guide

### If you're the issuer (running the allowlist)

1. Decide who should be admitted, and how many members you expect.
2. Run the allowlist generator (or use the "Issuer" tab in the demo):
   ```bash
   npm run generate-allowlist -- --count 500
   ```
3. This produces two files:
   - `allowlist-root.json` — a single short code (the "root"). This is the **only** thing that goes on-chain or gets shared publicly.
   - `allowlist-secrets.json` — one private secret per member. **Never share this whole file.** Send each member only their own single secret, privately (email, DM, printed card — however you'd hand out a password).
4. Publish the root on-chain (or paste it into the demo's "Issuer" panel to try it locally).

### If you're a member (proving you belong)

1. Get your private secret from the issuer.
2. Open the Gatecheck demo and go to the "Member" tab.
3. Paste in your secret. Click **Check access**.
4. Gatecheck builds a proof, in your own browser, that your secret belongs under the published root — your secret itself is never sent anywhere.
5. You'll see either **Access granted** (first time using this secret) or **Already used** (this secret has already checked in once — that's by design, so memberships can't be reused).

## What Gets Proved (and What Stays Private)

| | |
|---|---|
| **Proved publicly** | "This person holds a secret that's genuinely part of the allowlist, and hasn't used it before." |
| **Stays private, always** | Your actual secret. Which specific member you are. Your wallet or real identity. Any link between two of your own gate-checks. The rest of the allowlist (every other member's secret). |

## Troubleshooting

- **"Not a member of the current allowlist"** — the secret you entered doesn't correspond to any leaf under the currently published root. Double-check you copied your full secret, and confirm with your issuer that the root hasn't been rotated since you were enrolled.
- **"This membership has already been used"** — this exact secret has already completed a successful gate-check. Each secret can only pass once, on purpose. If you believe this is wrong, contact your issuer for a fresh secret.
- **Demo shows a fake wallet address** — the bundled demo simulates wallet connection so you can try the full flow without installing anything. See the README's "Deploying to Preprod" section to wire up a real Midnight/Lace wallet.
- **Nothing happens when I click "Check access"** — open your browser console for errors, and confirm you pasted a secret (not an empty field) and that an allowlist root has been published/loaded first.
