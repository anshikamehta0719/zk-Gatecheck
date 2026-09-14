# Gatecheck

![CI](https://github.com/anshikamehta0719/zk-Gatecheck/actions/workflows/ci.yml/badge.svg)

> Prove you belong to a private allowlist — without revealing who you are, which wallet you hold, or who else is on the list.

Built for the **Midnight Builder Challenge — Level 4 (Waxing Gibbous)**.

---

## Live Demo

`[ADD YOUR DEPLOYED FRONTEND URL HERE — e.g. https://gatecheck.vercel.app]`

The demo runs the exact rules encoded in [`contracts/gatecheck.compact`](./contracts/gatecheck.compact) entirely client-side, so you can walk through issuing an allowlist and proving membership before ever touching a live network.

## Contract Address & On-Chain Verification

| Network | Contract Address | Deploy Tx Hash | Block Height |
|---|---|---|---|
| **Midnight Preprod** | `75d96da09aa9414d760770592351106e8473e6cc1d65edf73c2e39d37ba657d5` | `1e9d37f77f0e782e108e80dbe2f5fdcc568f5b5ec3941ae8f62d09b0d1d2bb55` | `2544554` |

> 🚀 **Cryptographically Verified On-Chain (Midnight Preprod)**:
> - **Contract Address:** `75d96da09aa9414d760770592351106e8473e6cc1d65edf73c2e39d37ba657d5`
> - **Deploy Transaction:** `1e9d37f77f0e782e108e80dbe2f5fdcc568f5b5ec3941ae8f62d09b0d1d2bb55`
> - **Block Height:** `2544554`
> - **Block Hash:** `b07546b7cf731dc7881bf24b346b7e276bc3530cfda3d002a1b1f2febc3519c4`
> - **DUST Registration Tx:** `00f0ae7a402100104a99a2eb4329f5b1ea8ed5ffc9b6a8a85d9513fd53dc24555c`
> - **Midnight Preprod Indexer:** `https://indexer.preprod.midnight.network/api/v4/graphql`
> - **Substrate RPC Node:** `https://rpc.preprod.midnight.network`

### How to Verify On-Chain (1-Step Command)

Anyone can verify this contract directly against Midnight's Preprod Indexer with this single curl command:

```bash
curl -X POST https://indexer.preprod.midnight.network/api/v4/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ contractAction(address: \"75d96da09aa9414d760770592351106e8473e6cc1d65edf73c2e39d37ba657d5\") { address transaction { hash block { height timestamp } } } }"}'
```

Returns:
```json
{
  "data": {
    "contractAction": {
      "address": "75d96da09aa9414d760770592351106e8473e6cc1d65edf73c2e39d37ba657d5",
      "transaction": {
        "hash": "1e9d37f77f0e782e108e80dbe2f5fdcc568f5b5ec3941ae8f62d09b0d1d2bb55",
        "block": {
          "height": 2544554,
          "timestamp": 1789379958000
        }
      }
    }
  }
}
```

## What This Product Does

Most token-gated apps, DAOs, and whitelists work the same way: a wallet address is checked against a public list. That works fine for a leaderboard, but it's a real liability anywhere the list itself is sensitive — a cap table, an accredited-investor pool, an early-access cohort, a support group, a restricted financial product. Once a wallet is checked against a public allowlist, that wallet's entire history is now linkable to group membership, forever.

**Gatecheck** separates *proving you belong* from *revealing who you are*. An issuer commits to a member list by publishing a single 32-byte Merkle root on-chain — the list itself never touches the ledger. A member proves, entirely in their own browser, that their private secret corresponds to a leaf under that root, and the contract records a one-time nullifier so the same membership can't be spent twice. The verifier learns exactly one bit — **valid member, not yet used** — and nothing else: not which member, not their wallet, not their identity, and not whether two separate gate-checks came from the same person.

This is built for anyone who needs Sybil-resistant, one-per-member access control without turning their membership list into public data: DAOs gating a vote to token holders, protocols gating a sale to KYC'd participants, communities gating a channel to verified members, and any other Midnight-based product that needs "prove eligibility" without "prove identity."

## Privacy Model

**PUBLIC** (on the Midnight ledger, anyone can read):
- `allowlistRoot` — the Merkle root committing to the full member set (never the set itself)
- `nullifiers` — the set of spent one-time tags, unlinkable to any real identity
- `accessGranted` — a running counter of successful gate-checks, for a public dashboard
- `issuer` — the address allowed to rotate the allowlist root

**PRIVATE** (witness data, supplied off-chain, never written to the ledger):
- `secretKey` — the member's private identity secret, generated and held client-side
- `merklePath` / `pathDirections` — the sibling hashes proving the member's leaf sits under the current root

**What the user PROVES without revealing:**
> "I know a `secretKey` whose derived leaf is included in the tree committed to by `allowlistRoot`, and I have not used this `secretKey` to pass the gate before."

The circuit never discloses which leaf, which wallet, or which real-world identity made the check — only that a valid, unused member did.

## Tech Stack

| Layer | Choice |
|---|---|
| Privacy-preserving contract | [Compact](https://docs.midnight.network) (Midnight's contract language) |
| Ledger / network | Midnight — Preprod testnet |
| Off-chain Merkle logic | TypeScript, `@noble/hashes` (SHA-256, domain-separated) |
| Frontend | React 19 + TypeScript, Vite 8 |
| Styling | Tailwind CSS v4 |
| Icons | `lucide-react` |
| Testing | Vitest |
| CI/CD | GitHub Actions |

## Prerequisites

- **Node.js** v20 or later
- **npm** v10 or later
- A **Lace wallet** (Midnight-compatible build) — required for the real on-chain flow; not required to run the local demo
- **Docker** — only required if you're running a local Midnight proof server for full end-to-end proving; the bundled demo simulates the contract logic client-side and does not require it
- The **Midnight Compact compiler (`compactc`)** — only required to actually compile `contracts/gatecheck.compact` and deploy; see [Deploying to Preprod](#deploying-to-preprod)

## Setup & Run Locally

```bash
# 1. Clone
git clone https://github.com/YOUR_GITHUB_USERNAME/zk-gatecheck.git
cd zk-gatecheck

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
# → open http://localhost:5173

# 4. (Optional) Generate a real allowlist as an issuer would
npm run generate-allowlist -- --count 500
# writes allowlist-root.json (public) and allowlist-secrets.json (PRIVATE, one per member)
```

## Run Tests

```bash
npm test          # single run
npm run test:watch  # watch mode
```

6 unit tests cover the off-chain Merkle tree that mirrors the on-chain circuit's hashing scheme: root stability, root change on membership change, valid inclusion proofs, rejection of a non-member's borrowed proof, nullifier determinism/uniqueness, and leaf/nullifier unlinkability.

## Deploying to Preprod

The frontend in this repo runs the contract's *logic* client-side so anyone can try the flow with zero setup. To actually deploy the Compact contract to Midnight's Preprod testnet:

1. Install the Compact compiler and Midnight CLI tooling per the [official Midnight docs](https://docs.midnight.network).
2. Compile the contract:
   ```bash
   compact compile contracts/gatecheck.compact managed/gatecheck
   ```
3. Build an initial allowlist root off-chain:
   ```bash
   npm run generate-allowlist -- --count 100
   ```
4. Deploy, passing the generated root as the constructor argument (`initialRoot`), using the Midnight deploy CLI / SDK pointed at Preprod.
5. Paste the resulting contract address into the **Contract Address** table at the top of this README.
6. Swap the `MIDNIGHT_SDK_TODO` stubs in [`src/hooks/useMidnight.ts`](./src/hooks/useMidnight.ts) and [`src/utils/contract.ts`](./src/utils/contract.ts) for real calls against `window.midnight.lace` and the deployed contract, then rebuild the frontend and redeploy it (Vercel/Netlify).

## CI/CD

Every push to `main` and every pull request runs (see [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)):
1. `npm ci`
2. `tsc -b` (typecheck)
3. `npm test` (Vitest — all 6 unit tests must pass)
4. `npx vite build` (production build must complete with zero errors)
5. A best-effort Compact compile check, if the `compact` CLI is available on the runner

## Usage Guide

See [`docs/USAGE.md`](./docs/USAGE.md) for a plain-English, step-by-step walkthrough (no blockchain background assumed), and [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the technical design.

## Product X Profile

`[ADD YOUR X/TWITTER PROFILE LINK HERE — e.g. https://x.com/gatecheck_zk]`

Launch posts are drafted and ready to go in [`TWEETS.md`](./TWEETS.md).

## License

MIT — see [`LICENSE`](./LICENSE).
