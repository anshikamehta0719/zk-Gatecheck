import { KeyRound, Fingerprint } from "lucide-react";
import { Layout } from "./components/Layout";
import { GateMark } from "./components/GateMark";
import { GatecheckPanel } from "./components/GatecheckPanel";
import { useMidnight } from "./hooks/useMidnight";

const steps = [
  {
    n: "01",
    title: "Issuer commits the allowlist",
    body: "The full member list never touches the chain — only a single Merkle root does, published by the contract's issuer.",
  },
  {
    n: "02",
    title: "Member proves inclusion",
    body: "Locally, in your browser, a proof is generated that your secret's leaf sits under the published root. Your secret never leaves your device.",
  },
  {
    n: "03",
    title: "Contract checks in, once",
    body: "A one-time nullifier is recorded on-chain. It can't be linked back to your identity, and it can't be replayed.",
  },
];

export default function App() {
  const { wallet, connect, disconnect } = useMidnight();

  return (
    <Layout wallet={wallet} onConnect={connect} onDisconnect={disconnect}>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-line-soft">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(600px circle at 50% -10%, rgba(124,92,255,0.18), transparent 60%)",
          }}
        />
        <div className="relative mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
          <div className="mb-8 gate-ring">
            <GateMark size={72} />
          </div>
          <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            Prove you belong.
            <br />
            Reveal nothing else.
          </h1>
          <p className="mt-6 max-w-xl text-balance text-lg leading-relaxed text-ink-muted">
            Gatecheck lets a member prove membership in a private allowlist — a whitelist, a
            cap table, a verified cohort — without exposing their wallet, their identity, or the
            list itself. Built on Midnight.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#demo"
              className="rounded-full bg-veil px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-veil-glow"
            >
              Try the live gate
            </a>
            <a
              href="#privacy-model"
              className="rounded-full border border-line px-6 py-3 text-sm font-medium text-ink-muted transition-colors hover:border-line-soft hover:text-ink-text"
            >
              See the privacy model
            </a>
          </div>
        </div>
      </section>

      {/* WHAT'S PUBLIC / WHAT'S PRIVATE */}
      <section id="privacy-model" className="border-b border-line-soft">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-12 max-w-xl">
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Two ledgers. One gate.
            </h2>
            <p className="mt-3 text-ink-muted">
              Everything a verifier needs sits on-chain. Everything that could identify you never
              leaves your device.
            </p>
          </div>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-2">
            <div className="bg-ink-raised p-8">
              <div className="mb-4 flex items-center gap-2 text-veil-glow">
                <Fingerprint size={18} />
                <span className="font-data text-xs">on the Midnight ledger</span>
              </div>
              <h3 className="font-display text-lg font-medium">Public</h3>
              <ul className="mt-4 space-y-3 text-sm text-ink-muted">
                <li>The allowlist's Merkle root — a single 32-byte commitment</li>
                <li>A set of spent nullifiers, unlinked to any real identity</li>
                <li>A running count of successful gate-checks</li>
                <li>The issuer's address, for allowlist updates only</li>
              </ul>
            </div>
            <div className="bg-ink-raised p-8">
              <div className="mb-4 flex items-center gap-2 text-moon">
                <KeyRound size={18} />
                <span className="font-data text-xs">in your browser only</span>
              </div>
              <h3 className="font-display text-lg font-medium">Private</h3>
              <ul className="mt-4 space-y-3 text-sm text-ink-muted">
                <li>Your membership secret — generated and held client-side</li>
                <li>Your Merkle path — the proof that you're in the tree</li>
                <li>Which specific member you are, ever</li>
                <li>Any link between two separate gate-checks by the same person</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="border-b border-line-soft">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="mb-12 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            How a gate-check works
          </h2>
          <div className="grid gap-10 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n}>
                <span className="font-data text-sm text-veil-glow">{s.n}</span>
                <h3 className="mt-3 font-display text-lg font-medium">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LIVE DEMO */}
      <section id="demo" className="border-b border-line-soft">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-10 max-w-xl">
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Try it yourself
            </h2>
            <p className="mt-3 text-ink-muted">
              This runs the exact rules written in{" "}
              <code className="font-data text-[13px] text-ink-text">contracts/gatecheck.compact</code>{" "}
              locally in your browser, so you can see the whole flow before ever touching a
              testnet.
            </p>
          </div>
          <GatecheckPanel />
        </div>
      </section>

      {/* ABOUT / TECH */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight">Why this matters</h2>
            <p className="mt-4 text-sm leading-relaxed text-ink-muted">
              Most token-gates check a wallet address against a public list, permanently linking
              that wallet's full history to group membership. That's fine for a leaderboard — it's
              a liability for a cap table, a support group, or anything sensitive. Gatecheck
              separates <em>proving you belong</em> from <em>revealing who you are</em>, so gating
              stops requiring a trade-off.
            </p>
          </div>
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight">Built with</h2>
            <ul className="mt-4 grid grid-cols-2 gap-3 text-sm text-ink-muted">
              <li className="rounded-lg border border-line-soft px-3 py-2">Compact contract</li>
              <li className="rounded-lg border border-line-soft px-3 py-2">Midnight ledger</li>
              <li className="rounded-lg border border-line-soft px-3 py-2">React + TypeScript</li>
              <li className="rounded-lg border border-line-soft px-3 py-2">Vite + Tailwind v4</li>
            </ul>
          </div>
        </div>
      </section>
    </Layout>
  );
}
