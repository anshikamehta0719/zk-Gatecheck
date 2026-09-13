# Architecture

## Overview

```
                     ┌─────────────────────────────┐
                     │         Issuer               │
                     │  (off-chain, out of band)     │
                     │                               │
                     │  members[] ──▶ AllowlistTree  │
                     │                    │          │
                     │                    ▼          │
                     │              allowlistRoot     │
                     └───────────┬───────────────────┘
                                 │  publishAllowlist(root)
                                 ▼
                  ┌───────────────────────────────────┐
                  │      gatecheck.compact             │
                  │      (Midnight ledger contract)     │
                  │                                     │
                  │  public: allowlistRoot               │
                  │  public: nullifiers (Set<Bytes<32>>) │
                  │  public: accessGranted (Counter)     │
                  │  public: issuer                       │
                  └───────────────┬─────────────────────┘
                                  │  checkAccess()
                                  │  (secretKey, merklePath,
                                  │   pathDirections passed as
                                  │   PRIVATE witnesses)
                  ┌───────────────┴─────────────────────┐
                  │             Member's browser          │
                  │                                       │
                  │  secretKey (never leaves this box)     │
                  │  merklePath (derived locally)           │
                  │  ──▶ candidateRoot == allowlistRoot ?   │
                  │  ──▶ nullifier not yet spent ?           │
                  └───────────────────────────────────────┘
```

## Why a Merkle tree + nullifier, specifically

A Merkle tree lets an issuer commit to an arbitrarily large member set with a single fixed-size (32-byte) public value — the root. Proving "my leaf is in this tree" only requires `O(depth)` sibling hashes, so the on-chain state never grows with the member count, and nothing about the tree's contents is disclosed by the root alone.

A nullifier is the standard companion to this pattern: without it, the same secret could pass `checkAccess()` an unlimited number of times. The nullifier is a deterministic, one-way function of the secret (`persistent_hash("gatecheck:null" ++ secret)`), so:
- The same secret always produces the same nullifier (so reuse is detectable).
- The nullifier alone reveals nothing about the secret or the corresponding leaf (so reuse-detection doesn't leak identity).
- Two different members' nullifiers are, computationally, unlinkable to each other.

## Domain separation

Both the leaf commitment and the nullifier are derived from the same secret, but with different domain tags (`"gatecheck:leaf"` vs `"gatecheck:null"`) prepended before hashing. This is deliberate: without domain separation, an attacker could potentially confuse a leaf value for a nullifier value (or vice versa) in edge cases. Tagging each derivation with its purpose closes that class of issue and is considered standard practice in ZK circuit design.

## Off-chain / on-chain hash parity

`src/lib/merkleTree.ts` mirrors the tree-building and proof logic that the actual Compact circuit performs, using `sha256` from `@noble/hashes` as a stand-in for whatever hash primitive backs `persistent_hash` on Midnight (commonly a SNARK-friendly hash like Poseidon in production ZK systems). **Before a real deployment**, the off-chain hash primitive in `merkleTree.ts` must be swapped for whatever `persistent_hash` uses under the hood on Midnight, so that a root/proof computed off-chain verifies bit-for-bit against the on-chain circuit. This is called out explicitly in the file's header comment.

## Why depth 20

A depth-20 tree supports up to 2²⁰ (≈1,048,576) members per allowlist — comfortably more than any realistic MVP cohort — while keeping proof size (20 sibling hashes) and proving time small. The `AllowlistTree` class only ever computes real nodes that have at least one non-empty descendant (see the memoization/pruning logic in `src/lib/merkleTree.ts`); everything else resolves to a precomputed "empty subtree" constant, so tree operations stay proportional to the number of real members, not to `2^depth`.

## Frontend / contract boundary

The shipped frontend runs the *same rules* as `gatecheck.compact` — root recomputation, root comparison, nullifier check — entirely client-side, via `src/utils/contract.ts` and `src/hooks/useMidnight.ts`, so the full issuer → member → gate-check flow can be explored with zero setup. Every point where a real deployment needs to swap in the Midnight SDK (wallet connection, transaction submission, proof generation against the deployed contract) is marked with a `MIDNIGHT_SDK_TODO` comment in those two files.

## Threat model notes (MVP scope)

- **Sybil resistance**: bounded by how the issuer distributes secrets, not by the contract itself — the contract guarantees "one gate-check per secret," not "one gate-check per human." Real-world Sybil resistance depends on the issuer's off-chain vetting of who receives a secret.
- **Root rotation**: `publishAllowlist` intentionally does not clear existing nullifiers, so a member who already checked in under an old root can't replay that same nullifier under a new one either.
- **Front-running a gate-check**: since `checkAccess()` doesn't disclose which member is checking in, there's nothing member-identifying to front-run; the only race is over who claims a given nullifier first, which is exactly the double-use case the contract already rejects.
