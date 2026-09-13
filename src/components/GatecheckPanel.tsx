import { useState } from "react";
import { Eye, EyeOff, Plus, ShieldCheck, ShieldX, Sparkles, RotateCcw } from "lucide-react";
import { GateMark } from "./GateMark";
import { useMidnight } from "../hooks/useMidnight";
import type { Hex } from "../lib/merkleTree";

type GateStatus = "idle" | "checking" | "granted" | "denied-unknown" | "denied-used";

function short(hex: string, n = 6): string {
  return `${hex.slice(0, n + 2)}…${hex.slice(-n)}`;
}

export function GatecheckPanel() {
  const { state, createSecret, enroll, checkAccess, reset } = useMidnight();

  const [lastIssuedSecret, setLastIssuedSecret] = useState<Hex | null>(null);
  const [memberSecret, setMemberSecret] = useState("");
  const [revealSecret, setRevealSecret] = useState(false);
  const [status, setStatus] = useState<GateStatus>("idle");
  const [nullifier, setNullifier] = useState<Hex | null>(null);

  function handleAddMember() {
    const secret = createSecret();
    enroll([secret]);
    setLastIssuedSecret(secret);
  }

  function handleUseIssuedSecret() {
    if (lastIssuedSecret) {
      setMemberSecret(lastIssuedSecret);
      setStatus("idle");
      setNullifier(null);
    }
  }

  function handleOutsiderSecret() {
    setMemberSecret(createSecret());
    setStatus("idle");
    setNullifier(null);
  }

  async function handleCheckAccess() {
    if (!memberSecret) return;
    setStatus("checking");
    // brief pause so the proof-generation step reads as real work, not a toggle
    await new Promise((r) => setTimeout(r, 900));
    const result = checkAccess(memberSecret as Hex);
    if (result.ok) {
      setStatus("granted");
      setNullifier(result.nullifier);
    } else if (result.reason === "already-used") {
      setStatus("denied-used");
    } else {
      setStatus("denied-unknown");
    }
  }

  const gateVisualState = status === "granted" ? "open" : status.startsWith("denied") ? "closed" : "idle";

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-ink-raised">
      <div className="grid md:grid-cols-2">
        {/* ISSUER CONSOLE */}
        <div className="border-b border-line p-6 md:border-b-0 md:border-r md:p-8">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="font-display text-lg font-medium">Issuer console</h3>
            <span className="rounded-full border border-line-soft px-2.5 py-1 font-data text-[11px] text-ink-faint">
              runs as the deployed contract
            </span>
          </div>
          <p className="mb-6 text-sm leading-relaxed text-ink-muted">
            Enroll a member and Gatecheck privately hands them a secret off-chain — only the
            resulting Merkle root ever reaches the ledger.
          </p>

          <button
            onClick={handleAddMember}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-veil-dim bg-veil/10 px-4 py-2.5 text-sm font-medium text-veil-glow transition-colors hover:bg-veil/20"
          >
            <Plus size={16} />
            Enroll a new member
          </button>

          {lastIssuedSecret && (
            <button
              onClick={handleUseIssuedSecret}
              className="mb-6 flex w-full items-center justify-center gap-2 rounded-lg border border-line px-4 py-2.5 text-sm text-ink-muted transition-colors hover:border-line-soft hover:text-ink-text"
            >
              <Sparkles size={14} />
              Try that member's secret in the gate →
            </button>
          )}

          <dl className="space-y-3 rounded-xl border border-line-soft bg-ink-panel p-4 font-data text-[13px]">
            <div className="flex items-center justify-between">
              <dt className="text-ink-faint">allowlistRoot</dt>
              <dd className="text-ink-text">{short(state.allowlistRoot)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-faint">members enrolled</dt>
              <dd className="text-ink-text">{state.memberCount}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-faint">accessGranted</dt>
              <dd className="text-ink-text">{state.accessGranted}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-faint">contract</dt>
              <dd className="text-ink-text">{short(state.contractAddress)}</dd>
            </div>
          </dl>

          <p className="mt-4 text-xs leading-relaxed text-ink-faint">
            This panel represents what happens on-chain. Nothing here identifies which member is
            which — only the root and a running count are public.
          </p>
        </div>

        {/* MEMBER GATE */}
        <div className="p-6 md:p-8">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="font-display text-lg font-medium">Member gate</h3>
            <span className="rounded-full border border-line-soft px-2.5 py-1 font-data text-[11px] text-ink-faint">
              runs in your browser only
            </span>
          </div>

          <label className="mb-2 block text-sm text-ink-muted">Your private membership secret</label>
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-line bg-ink-panel px-3 py-2.5">
            <input
              value={memberSecret}
              onChange={(e) => {
                setMemberSecret(e.target.value);
                setStatus("idle");
                setNullifier(null);
              }}
              type={revealSecret ? "text" : "password"}
              placeholder="0x… paste or generate a secret"
              className="w-full bg-transparent font-data text-[13px] text-ink-text outline-none placeholder:text-ink-faint"
            />
            <button
              onClick={() => setRevealSecret((v) => !v)}
              aria-label={revealSecret ? "Hide secret" : "Reveal secret"}
              className="text-ink-faint transition-colors hover:text-ink-muted"
            >
              {revealSecret ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          <button
            onClick={handleOutsiderSecret}
            className="mb-6 text-xs text-ink-faint underline decoration-line-soft underline-offset-4 transition-colors hover:text-ink-muted"
          >
            or try a random outsider secret (should be denied)
          </button>

          <button
            onClick={handleCheckAccess}
            disabled={!memberSecret || status === "checking"}
            className="mb-6 flex w-full items-center justify-center gap-2 rounded-lg bg-veil px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-veil-glow disabled:cursor-not-allowed disabled:opacity-40"
          >
            {status === "checking" ? "Generating zero-knowledge proof…" : "Prove membership & enter"}
          </button>

          <div className="flex flex-col items-center gap-3 rounded-xl border border-line-soft bg-ink-panel py-8">
            <GateMark size={44} state={gateVisualState} />
            {status === "idle" && <p className="text-sm text-ink-faint">Awaiting proof</p>}
            {status === "checking" && (
              <p className="text-sm text-ink-muted">Proving inclusion without revealing the leaf…</p>
            )}
            {status === "granted" && (
              <div className="flex flex-col items-center gap-1 text-center">
                <span className="flex items-center gap-1.5 text-sm font-medium text-moon">
                  <ShieldCheck size={16} /> Access granted
                </span>
                <span className="font-data text-xs text-ink-faint">
                  nullifier {nullifier ? short(nullifier) : ""} recorded — this secret can't be reused
                </span>
              </div>
            )}
            {status === "denied-used" && (
              <div className="flex flex-col items-center gap-1 text-center">
                <span className="flex items-center gap-1.5 text-sm font-medium text-signal">
                  <ShieldX size={16} /> Already used
                </span>
                <span className="text-xs text-ink-faint">this membership already checked in once</span>
              </div>
            )}
            {status === "denied-unknown" && (
              <div className="flex flex-col items-center gap-1 text-center">
                <span className="flex items-center gap-1.5 text-sm font-medium text-signal">
                  <ShieldX size={16} /> Not a member
                </span>
                <span className="text-xs text-ink-faint">no leaf under the current root matches this secret</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-line px-6 py-3 md:px-8">
        <p className="text-xs text-ink-faint">Resets the simulated ledger — for demo purposes only.</p>
        <button
          onClick={() => {
            reset();
            setLastIssuedSecret(null);
            setMemberSecret("");
            setStatus("idle");
            setNullifier(null);
          }}
          className="flex items-center gap-1.5 text-xs text-ink-muted transition-colors hover:text-ink-text"
        >
          <RotateCcw size={12} />
          Reset demo
        </button>
      </div>
    </div>
  );
}
