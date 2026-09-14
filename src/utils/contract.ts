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
  "75d96da09aa9414d760770592351106e8473e6cc1d65edf73c2e39d37ba657d5" as Hex;

/**
 * Simulated on-chain state. In production this lives entirely in the
 * Compact contract's ledger — nothing here would be client-side.
 */
class SimulatedGatecheckLedger {
  private tree = new AllowlistTree(20);
  private indexBySecret = new Map<Hex, number>();
  private spentNullifiers = new Set<Hex>();
  private accessGranted = 0;
  private cachedState: LedgerState | null = null;

  enroll(secret: Hex): void {
    const index = this.tree.addMember(leafOf(secret));
    this.indexBySecret.set(secret, index);
    this.cachedState = null;
  }

  publicState(): LedgerState {
    if (!this.cachedState) {
      this.cachedState = {
        allowlistRoot: this.tree.root(),
        memberCount: this.tree.size(),
        accessGranted: this.accessGranted,
        spentNullifiers: new Set(this.spentNullifiers),
        contractAddress: DEMO_CONTRACT_ADDRESS,
      };
    }
    return this.cachedState;
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
    this.cachedState = null;
    return { ok: true, nullifier };
  }

  reset(): void {
    this.tree = new AllowlistTree(20);
    this.indexBySecret.clear();
    this.spentNullifiers.clear();
    this.accessGranted = 0;
    this.cachedState = null;
  }
}

export const ledger = new SimulatedGatecheckLedger();
