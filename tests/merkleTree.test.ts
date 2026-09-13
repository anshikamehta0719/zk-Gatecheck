import { describe, it, expect } from "vitest";
import {
  AllowlistTree,
  generateSecret,
  leafOf,
  nullifierOf,
  verifyProof,
} from "../src/lib/merkleTree";

describe("AllowlistTree", () => {
  it("produces a stable root for the same set of members", () => {
    const secrets = [generateSecret(), generateSecret(), generateSecret()];
    const treeA = new AllowlistTree(20);
    const treeB = new AllowlistTree(20);
    for (const s of secrets) {
      treeA.addMember(leafOf(s));
      treeB.addMember(leafOf(s));
    }
    expect(treeA.root()).toBe(treeB.root());
  });

  it("changes the root when the member set changes", () => {
    const tree = new AllowlistTree(20);
    tree.addMember(leafOf(generateSecret()));
    const rootBefore = tree.root();
    tree.addMember(leafOf(generateSecret()));
    expect(tree.root()).not.toBe(rootBefore);
  });

  it("generates a valid inclusion proof a real member can pass", () => {
    const mySecret = generateSecret();
    const tree = new AllowlistTree(20);
    tree.addMember(leafOf(generateSecret()));
    const myIndex = tree.addMember(leafOf(mySecret));
    tree.addMember(leafOf(generateSecret()));

    const proof = tree.proofFor(myIndex);
    const ok = verifyProof(leafOf(mySecret), proof, tree.root());
    expect(ok).toBe(true);
  });

  it("rejects a proof for a secret that was never enrolled", () => {
    const tree = new AllowlistTree(20);
    tree.addMember(leafOf(generateSecret()));
    const outsider = generateSecret();
    // Outsider has no real index — simulate them borrowing member 0's path.
    const borrowedProof = tree.proofFor(0);
    const ok = verifyProof(leafOf(outsider), borrowedProof, tree.root());
    expect(ok).toBe(false);
  });

  it("derives a stable, unique nullifier per secret", () => {
    const s1 = generateSecret();
    const s2 = generateSecret();
    expect(nullifierOf(s1)).toBe(nullifierOf(s1));
    expect(nullifierOf(s1)).not.toBe(nullifierOf(s2));
  });

  it("keeps leaf and nullifier unlinkable-looking (different digests)", () => {
    const secret = generateSecret();
    expect(leafOf(secret)).not.toBe(nullifierOf(secret));
  });
});
