# Gatecheck — Product Proposal (from Level 3)

**Category:** Identity / Credentials

## Problem Statement

Web3 communities, DAOs, and token-gated platforms routinely need to verify that a user belongs to an approved list — investors on a KYC'd cap table, holders of a specific NFT collection, whitelisted early adopters, verified employees, or accredited investors — before granting access to a sale, vote, or resource. Today, this is almost always done by publicly checking a wallet address against an on-chain or off-chain list, which permanently links that wallet's entire transaction history and identity to group membership. This exposes users to targeted phishing, doxxing, discriminatory pricing, and unwanted surveillance of their holdings, and it discourages sensitive use cases (e.g. whistleblower networks, medical support groups, restricted financial products) from using on-chain gating at all.

## Proposed Solution

A Midnight-based dApp where an issuer publishes a commitment to an allowlist (a Merkle root of eligible identities/secrets). Users generate a zero-knowledge proof that they possess a credential included in that commitment — without revealing *which* entry is theirs or exposing the list itself. The verifier only learns "this is a valid, unused member of the allowlist," with a nullifier preventing double-access, while the underlying identity, wallet history, and full list membership stay private.

## Why This Fits Midnight

Midnight's shielded-state model and Compact contract language let the privacy-critical core — the membership proof and nullifier check — live entirely on-chain as verifiable logic, while every sensitive input (the secret, the Merkle path) stays a private witness that never touches the ledger. This is exactly the "prove without disclosing" pattern Midnight is built for, and it generalizes cleanly to DeFi whitelists, DAO voting rights, gated content, and private KYC.

## Level 4 Scope

For this MVP, scope is deliberately narrowed to one clean flow:
- One issuer, one published allowlist root at a time (with rotation support)
- One proof type: Merkle inclusion + nullifier
- No multi-credential types, no revocation lists, no cross-chain identity — those are natural Level 5/6 extensions once this core is proven out.
