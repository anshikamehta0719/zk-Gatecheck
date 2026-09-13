/**
 * utils/contract.ts
 * ----------------------------------------------------------------------------
 * This module is the single seam between the UI and "the chain". It currently
 * runs a local, in-memory ledger that reproduces the exact rules written in
 * contracts/gatecheck.compact (same root/nullifier/counter semantics), so the
 * full demo works end-to-end today without a live deployment.
 *
 * Once you've run `compact compile` and deployed to Preprod, replace the body
 * of each function below with the corresponding Midnight SDK call. The
 * function signatures are already shaped to match what the SDK expects, so
 * the rest of the app (hooks + components) does not need to change.
 *
 *   MIDNIGHT_SDK_TODO — publishAllowlist(newRoot):
 *     const providers = await configureProviders(wallet);
 *     const contract = new GatecheckContract(providers);
 *     await contract.circuits.publishAllowlist(newRoot);
 *
 *   MIDNIGHT_SDK_TODO — checkAccess(secretKey, path, directions):
 *     const tx = await contract.circuits.checkAccess({
 *       witnesses: { secretKey, merklePath: path, pathDirections: directions },
 *     });
 *     await tx.submit();
 *
 *   MIDNIGHT_SDK_TODO — readPublicState():
 *     const ledgerState = await providers.publicDataProvider
 *       .queryContractState(CONTRACT_ADDRESS);
 * ----------------------------------------------------------------------------
 */
import {
  AllowlistTree,
  leafOf,
  nullifierOf,
  verifyProof,
  type Hex,
} from "../lib/merkleTree";

export interface LedgerState {
  allowlistRoot: Hex;
  memberCount: number;
  accessGranted: number;
  spentNullifiers: Set<Hex>;
  contractAddress: Hex;
}

export type CheckAccessResult =
  | { ok: true; nullifier: Hex }
  | { ok: false; reason: "not-a-member" | "already-used" };

const DEMO_CONTRACT_ADDRESS =
  "0x02f1a6c9d4e7b83a1c5f0e9d2b4a7c6e1f3d8b0a9c2e5f7a1b4d6c8e0a2f4b6d" as Hex;

/**
 * Simulated on-chain state. In production this lives entirely in the
 * Compact contract's ledger — nothing here would be client-side.
 */
class SimulatedGatecheckLedger {
  private tree = new AllowlistTree(20);
  private indexBySecret = new Map<Hex, number>();
  private spentNullifiers = new Set<Hex>();
  private accessGranted = 0;

  enroll(secret: Hex): void {
    const index = this.tree.addMember(leafOf(secret));
    this.indexBySecret.set(secret, index);
  }

  publicState(): LedgerState {
    return {
      allowlistRoot: this.tree.root(),
      memberCount: this.tree.size(),
      accessGranted: this.accessGranted,
      spentNullifiers: new Set(this.spentNullifiers),
      contractAddress: DEMO_CONTRACT_ADDRESS,
    };
  }

  /** Mirrors the `checkAccess` circuit's assertions exactly. */
  checkAccess(secret: Hex): CheckAccessResult {
    const index = this.indexBySecret.get(secret);
    if (index === undefined) {
      return { ok: false, reason: "not-a-member" };
    }
    const leaf = leafOf(secret);
    const proof = this.tree.proofFor(index);
    const validMembership = verifyProof(leaf, proof, this.tree.root());
    if (!validMembership) {
      return { ok: false, reason: "not-a-member" };
    }

    const nullifier = nullifierOf(secret);
    if (this.spentNullifiers.has(nullifier)) {
      return { ok: false, reason: "already-used" };
    }

    this.spentNullifiers.add(nullifier);
    this.accessGranted += 1;
    return { ok: true, nullifier };
  }

  reset(): void {
    this.tree = new AllowlistTree(20);
    this.indexBySecret.clear();
    this.spentNullifiers.clear();
    this.accessGranted = 0;
  }
}

export const ledger = new SimulatedGatecheckLedger();
