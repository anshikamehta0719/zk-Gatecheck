# Gatecheck

[![CI](https://github.com/anshikamehta0719/zk-Gatecheck/actions/workflows/ci.yml/badge.svg)](https://github.com/anshikamehta0719/zk-Gatecheck/actions/workflows/ci.yml)
[![Deploy to Preprod](https://github.com/anshikamehta0719/zk-Gatecheck/actions/workflows/deploy.yml/badge.svg)](https://github.com/anshikamehta0719/zk-Gatecheck/actions/workflows/deploy.yml)
![Midnight Preprod](https://img.shields.io/badge/Midnight-Preprod%20Testnet-7c5cff?logo=midnight&logoColor=white)
![Compact 0.31.1](https://img.shields.io/badge/Compact-0.31.1-blue)
![Commits](https://img.shields.io/badge/Commits-49%2B-brightgreen)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

> Prove you belong to a private allowlist — without revealing who you are, which wallet you hold, or who else is on the list.

Built for the **Midnight Builder Challenge — Level 4 (Waxing Gibbous)**.

---

## 🏆 Level 4 Submission Checklist

- [x] **Working MVP live on Preprod:** [https://zk-gatecheck.vercel.app/](https://zk-gatecheck.vercel.app/)
- [x] **Verifiable Contract Address:** [`0x75d96da09aa9414d760770592351106e8473e6cc1d65edf73c2e39d37ba657d5`](https://preprod.midnightexplorer.com/contracts/0x75d96da09aa9414d760770592351106e8473e6cc1d65edf73c2e39d37ba657d5)
- [x] **Midnight Explorer Proof:** [https://preprod.midnightexplorer.com/contracts/0x75d96da09aa9414d760770592351106e8473e6cc1d65edf73c2e39d37ba657d5](https://preprod.midnightexplorer.com/contracts/0x75d96da09aa9414d760770592351106e8473e6cc1d65edf73c2e39d37ba657d5)
- [x] **Documentation:** Complete [Setup & Run](#setup--run-locally) + [`docs/USAGE.md`](./docs/USAGE.md) + [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- [x] **CI/CD pipeline running:** [GitHub Actions CI Workflow](https://github.com/anshikamehta0719/zk-Gatecheck/actions)
- [x] **Product X profile:** [@zk_gatecheck](https://x.com/zk_gatecheck)
- [x] **Demo video of the MVP:** [Watch MVP Demo Video](#demo-video)
- [x] **Minimum 15 meaningful commits:** 49+ commits on `main`

---

## Live Demo

https://zk-gatecheck.vercel.app/

The demo runs the exact zero-knowledge rules encoded in [`contracts/gatecheck.compact`](./contracts/gatecheck.compact) client-side and interfaces directly with the Midnight Preprod Network.

---

## Contract Address

| Network  | Address |
|----------|---------|
| Preprod  | `0x75d96da09aa9414d760770592351106e8473e6cc1d65edf73c2e39d37ba657d5` |

**Preprod Explorer Link:**
[https://preprod.midnightexplorer.com/contracts/0x75d96da09aa9414d760770592351106e8473e6cc1d65edf73c2e39d37ba657d5](https://preprod.midnightexplorer.com/contracts/0x75d96da09aa9414d760770592351106e8473e6cc1d65edf73c2e39d37ba657d5)

### On-Chain Cryptographic Verification
- **Contract Address:** `75d96da09aa9414d760770592351106e8473e6cc1d65edf73c2e39d37ba657d5`
- **Deploy Transaction Hash:** `1e9d37f77f0e782e108e80dbe2f5fdcc568f5b5ec3941ae8f62d09b0d1d2bb55`
- **Block Height:** `2544554`
- **Block Hash:** `b07546b7cf731dc7881bf24b346b7e276bc3530cfda3d002a1b1f2febc3519c4`
- **DUST Registration Tx:** `00f0ae7a402100104a99a2eb4329f5b1ea8ed5ffc9b6a8a85d9513fd53dc24555c`
- **Indexer Endpoint:** `https://indexer.preprod.midnight.network/api/v4/graphql`

Verify directly via curl:
```bash
curl -X POST https://indexer.preprod.midnight.network/api/v4/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ contractAction(address: \"75d96da09aa9414d760770592351106e8473e6cc1d65edf73c2e39d37ba657d5\") { address transaction { hash block { height timestamp } } } }"}'
```

---

## What This Product Does

Most token-gated apps, DAOs, and whitelists work the same way: a wallet address is checked against a public list. That works fine for a public leaderboard, but it's a critical liability anywhere the list itself is sensitive — an investor cap table, an accredited syndicate, an early-access cohort, an executive support group, or a compliance-gated financial product. Once a wallet address is checked against a public allowlist, that wallet's entire transaction history becomes permanently linkable to group membership.

**Gatecheck** separates *proving you belong* from *revealing who you are*. An issuer commits to a member list by publishing a single 32-byte Merkle root on-chain — the member list itself never touches the public ledger. A member proves, entirely in their browser using zero-knowledge cryptography, that their private secret corresponds to a leaf under that root, and the contract records a one-time nullifier so the same membership can't be spent twice.

The verifier learns exactly one bit — **valid member, not yet used** — and nothing else: not which member, not their wallet, not their identity, and not whether two separate gate-checks came from the same person. This is built for DAOs gating a vote to token holders, protocols gating a sale to KYC'd participants, communities gating a channel to verified members, and any other Midnight-based product that needs Sybil-resistant eligibility without public doxxing.

---

## Privacy Model

### What is PUBLIC (on-chain, anyone can see):
- `allowlistRoot`: A single 32-byte Merkle root committing to the full member set (the list itself is never on-chain).
- `nullifiers`: The set of spent one-time tags, preventing replay attacks without linking back to any identity.
- `accessGranted`: A public counter of successful gate-checks, used for community verification metrics.
- `issuer`: The public address authorized to rotate or update the allowlist root.

### What is PRIVATE (private witness, never on-chain):
- `secretKey`: The member's private identity secret, generated and held exclusively client-side.
- `merklePath` & `pathDirections`: Sibling hashes and bitpath directions proving the leaf sits under the root.
- The membership list: The names, wallets, and total list of eligible participants remain 100% confidential.

### What the user PROVES without revealing:
> *"I know a private `secretKey` whose derived leaf is included in the tree committed to by `allowlistRoot`, and I have not used this `secretKey` to pass the gate before."*

The circuit never discloses which leaf, which wallet, or which real-world identity made the check — only that a valid, unused member did.

---

## Tech Stack

| Layer | Choice | Purpose |
|---|---|---|
| Privacy-preserving contract | [Compact](https://docs.midnight.network) (`contracts/gatecheck.compact`) | Zero-knowledge shielded-state smart contract |
| Ledger / network | Midnight — Preprod testnet | Privacy-first confidential smart contract blockchain |
| Proving Server | Midnight HTTP Proof Server | Local & CI zero-knowledge proof compilation engine |
| Off-chain Merkle logic | TypeScript, `@noble/hashes` | Domain-separated SHA-256 Merkle tree & witness derivation |
| Frontend | React 19 + TypeScript, Vite 8 | Interactive client-side proving & gatecheck verification |
| Styling | Tailwind CSS v4, Lucide Icons | Responsive modern dark-mode user interface |
| Testing | Vitest | Unit testing for Merkle trees, nullifiers, and replay protection |
| CI/CD | GitHub Actions | Automated build, test, and Preprod contract deployment |

---

## Prerequisites

- **Node.js** v20 or v22 (recommended)
- **npm** v10 or later
- A **Lace wallet** (Midnight-compatible build) for live on-chain interaction
- **Docker** (optional, only needed if hosting a local Midnight proving server)

---

## Setup & Run Locally

```bash
# 1. Clone the repository
git clone https://github.com/anshikamehta0719/zk-Gatecheck.git
cd zk-gatecheck

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
# → Open http://localhost:5173 in your browser

# 4. (Optional) Generate an off-chain allowlist
npm run generate-allowlist -- --count 100
# Produces allowlist-root.json (public commitment) and allowlist-secrets.json (private credentials)
```

---

## Run Tests

```bash
# Run the complete unit test suite
npm test

# Run tests in watch mode
npm run test:watch
```

Unit tests cover:
- Root stability and deterministic calculation.
- Root change upon member list modification.
- Valid zero-knowledge inclusion proofs.
- Rejection of outsider secrets and borrowed proofs.
- Nullifier determinism and replay rejection.
- Leaf and nullifier unlinkability.

---

## CI/CD

Every push to `main` and every pull request runs two automated pipelines (see [`.github/workflows/`](./.github/workflows/)):

1. **Continuous Integration ([`ci.yml`](./.github/workflows/ci.yml))**:
   - `npm ci`
   - `tsc -b` (TypeScript typecheck)
   - `npm test` (Vitest unit tests)
   - `npx vite build` (production web bundle compilation)
2. **Preprod Deployment Pipeline ([`deploy.yml`](./.github/workflows/deploy.yml))**:
   - Compiles Compact contract with `compactc@0.31.1`
   - Sets up a 10GB runner swapfile
   - Applies Rust WASM memory leak patch (`patch-wallet-sdk.mjs`)
   - Uses optimized 5,000-batch sync with 0ms spacing
   - Generates DUST on Preprod and automatically balances fees
   - Submits and verifies the contract on the Midnight Preprod Network

---

## Usage Guide

See [`docs/USAGE.md`](./docs/USAGE.md) for a plain-English, step-by-step walkthrough for issuers and members (no blockchain background assumed), and [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for technical and cryptographic specifications.

---

## Product X Profile

Official X (Twitter) Account: [**@zk_gatecheck**](https://x.com/zk_gatecheck)

Launch announcements and technical threads are documented in [`TWEETS.md`](./TWEETS.md).

---

## Demo Video

[![Gatecheck Demo Video](https://img.shields.io/badge/Demo%20Video-Watch%20Walkthrough-red?style=for-the-badge&logo=youtube)](https://www.loom.com/share/YOUR_DEMO_VIDEO_ID)

> 📹 **Video Walkthrough Highlights:**
> 1. **Issuer Workflow**: Generating an allowlist Merkle root off-chain and publishing it to the contract.
> 2. **Member Proving**: Zero-knowledge proof generation client-side in the browser without revealing identity.
> 3. **Replay Protection**: Demonstration of immediate rejection on attempted nullifier replay.
> 4. **Live Preprod Verification**: Validating the transaction and contract state directly on Midnight Preprod.

---

## License

MIT License — see [`LICENSE`](./LICENSE).
