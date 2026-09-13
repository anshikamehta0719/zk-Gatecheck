import { describe, it, expect, beforeEach } from "vitest";
import { ledger } from "../src/utils/contract";
import { generateSecret, type Hex } from "../src/lib/merkleTree";

describe("SimulatedGatecheckLedger (mirrors gatecheck.compact::checkAccess)", () => {
  beforeEach(() => {
    ledger.reset();
  });

  it("grants access to a freshly enrolled member", () => {
    const secret = generateSecret();
    ledger.enroll(secret);

    const result = ledger.checkAccess(secret);
    expect(result.ok).toBe(true);
  });

  it("rejects a secret that was never enrolled", () => {
    ledger.enroll(generateSecret());
    const outsider = generateSecret();

    const result = ledger.checkAccess(outsider);
    expect(result).toEqual({ ok: false, reason: "not-a-member" });
  });

  it("rejects a second gate-check with the same secret (nullifier reuse)", () => {
    const secret = generateSecret();
    ledger.enroll(secret);

    const first = ledger.checkAccess(secret);
    const second = ledger.checkAccess(secret);

    expect(first.ok).toBe(true);
    expect(second).toEqual({ ok: false, reason: "already-used" });
  });

  it("tracks accessGranted as a public counter, incremented once per unique member", () => {
    const secrets: Hex[] = [generateSecret(), generateSecret(), generateSecret()];
    secrets.forEach((s) => ledger.enroll(s));

    secrets.forEach((s) => ledger.checkAccess(s));
    // Replay attempt shouldn't move the counter.
    ledger.checkAccess(secrets[0]);

    expect(ledger.publicState().accessGranted).toBe(3);
  });

  it("never exposes which member index corresponds to a passing secret", () => {
    const secret = generateSecret();
    ledger.enroll(secret);
    ledger.checkAccess(secret);

    const state = ledger.publicState();
    // The public state surface must only contain root/count/nullifiers/address —
    // never a per-secret or per-index mapping.
    expect(Object.keys(state).sort()).toEqual(
      ["accessGranted", "allowlistRoot", "contractAddress", "memberCount", "spentNullifiers"].sort(),
    );
  });
});
