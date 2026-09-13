/**
 * merkleTree.ts
 * ----------------------------------------------------------------------------
 * Off-chain companion to contracts/gatecheck.compact.
 *
 * The contract only ever sees a 32-byte root. This module is how an issuer
 * builds that root from a real list of members, and how a member later
 * derives the private "merklePath" witness they feed into `checkAccess()`.
 *
 * The hashing scheme here (domain-separated sha256) mirrors the domain
 * separation used by `persistent_hash` in the Compact contract 1:1 in shape
 * (label ++ data), so the tree structure lines up. Swap `hashPair` /
 * `hashLeaf` for the project's production hash primitive (e.g. Poseidon via
 * the Midnight SDK) before deploying to a network where circuit and
 * off-chain hashes must match bit-for-bit.
 * ----------------------------------------------------------------------------
 */
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes, utf8ToBytes, concatBytes } from "@noble/hashes/utils";

export const TREE_DEPTH = 20;

export type Hex = `0x${string}`;

function toHex(bytes: Uint8Array): Hex {
  return `0x${bytesToHex(bytes)}`;
}

function domainTag(label: string): Uint8Array {
  const raw = utf8ToBytes(label);
  const padded = new Uint8Array(32);
  padded.set(raw.slice(0, 32));
  return padded;
}

/** Derives a member's leaf commitment from their private secret. */
export function leafOf(secretHex: Hex): Hex {
  const secret = hexToBytes(secretHex.slice(2));
  return toHex(sha256(concatBytes(domainTag("gatecheck:leaf"), secret)));
}

/** Derives the one-time nullifier tag for a member's secret. */
export function nullifierOf(secretHex: Hex): Hex {
  const secret = hexToBytes(secretHex.slice(2));
  return toHex(sha256(concatBytes(domainTag("gatecheck:null"), secret)));
}

function hashPair(left: Uint8Array, right: Uint8Array): Uint8Array {
  return sha256(concatBytes(left, right));
}

/** Generates a fresh random 32-byte member secret (kept client-side only). */
export function generateSecret(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export interface MerkleProof {
  path: Hex[];
  directions: boolean[]; // true = sibling is on the left
}

/**
 * A fixed-depth (TREE_DEPTH) sparse Merkle tree over member leaves.
 * Empty slots are filled with a deterministic "empty leaf" so the root
 * is well-defined regardless of how many real members are enrolled.
 */
export class AllowlistTree {
  private readonly depth: number;
  private readonly emptyLevels: Uint8Array[];
  private readonly leaves: Map<number, Uint8Array> = new Map();
  // Memoizes computed (level,index) nodes so recomputing the root or a
  // proof never re-hashes the same subtree twice. Combined with the
  // "entirely empty subtree" short-circuit below, cost stays O(members),
  // not O(2^depth) — depth 20 with a handful of real members resolves in
  // microseconds instead of walking a million-leaf tree.
  private readonly cache: Map<string, Uint8Array> = new Map();

  constructor(depth: number = TREE_DEPTH) {
    this.depth = depth;
    this.emptyLevels = [sha256(domainTag("gatecheck:empty"))];
    for (let i = 1; i <= depth; i++) {
      const prev = this.emptyLevels[i - 1];
      this.emptyLevels.push(hashPair(prev, prev));
    }
  }

  /** Adds a member (by their public leaf commitment) at the next free index. */
  addMember(leafHex: Hex): number {
    const index = this.leaves.size;
    if (index >= 2 ** this.depth) {
      throw new Error("allowlist tree is full");
    }
    this.leaves.set(index, hexToBytes(leafHex.slice(2)));
    this.cache.clear(); // member set changed, invalidate memoized nodes
    return index;
  }

  private levelHash(level: number, index: number): Uint8Array {
    if (level === 0) {
      return this.leaves.get(index) ?? this.emptyLevels[0];
    }
    const left = this.nodeAt(level - 1, index * 2);
    const right = this.nodeAt(level - 1, index * 2 + 1);
    return hashPair(left, right);
  }

  private nodeAt(level: number, index: number): Uint8Array {
    // Every leaf under this node lives in [index * 2^level, (index+1) * 2^level).
    // If that whole range starts past the last real member, the subtree is
    // guaranteed to be the canonical "empty" node for this level — skip the
    // recursion entirely instead of walking down to prove what we already know.
    const span = 2 ** level;
    const startLeaf = index * span;
    if (startLeaf >= this.leaves.size) {
      return this.emptyLevels[level];
    }

    const key = `${level}:${index}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const value = this.levelHash(level, index);
    this.cache.set(key, value);
    return value;
  }

  /** The current public root — this is the only value published on-chain. */
  root(): Hex {
    return toHex(this.nodeAt(this.depth, 0));
  }

  /** Builds the private Merkle path + directions for a given member index. */
  proofFor(index: number): MerkleProof {
    const path: Hex[] = [];
    const directions: boolean[] = [];
    let idx = index;
    for (let level = 0; level < this.depth; level++) {
      const siblingIndex = idx % 2 === 0 ? idx + 1 : idx - 1;
      const isLeftChild = idx % 2 === 0;
      path.push(toHex(this.nodeAt(level, siblingIndex)));
      directions.push(!isLeftChild); // sibling is on the left if we're the right child
      idx = Math.floor(idx / 2);
    }
    return { path, directions };
  }

  size(): number {
    return this.leaves.size;
  }
}

/** Pure verification helper — recomputes a root from a leaf + proof. */
export function verifyProof(leafHex: Hex, proof: MerkleProof, expectedRoot: Hex): boolean {
  let current = hexToBytes(leafHex.slice(2));
  for (let i = 0; i < proof.path.length; i++) {
    const sibling = hexToBytes(proof.path[i].slice(2));
    current = proof.directions[i] ? hashPair(sibling, current) : hashPair(current, sibling);
  }
  return toHex(current) === expectedRoot;
}
