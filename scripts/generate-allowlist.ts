/**
 * generate-allowlist.ts
 * ----------------------------------------------------------------------------
 * Issuer-side CLI: turns a list of member secrets (or freshly generated ones)
 * into the single 32-byte Merkle root that gets published on-chain via
 * `publishAllowlist(newRoot)` in contracts/gatecheck.compact.
 *
 * Usage:
 *   npx tsx scripts/generate-allowlist.ts --count 500
 *   npx tsx scripts/generate-allowlist.ts --secrets ./members.json
 *
 * Output:
 *   allowlist-root.json   — the public root to publish on-chain
 *   allowlist-secrets.json — the private secrets to hand out to members
 *                            (each member only ever needs THEIR OWN entry —
 *                            never ship this whole file to end users)
 *
 * This never touches the network. It's pure off-chain bookkeeping so an
 * issuer can build/rotate a cohort before a single transaction is sent.
 * ----------------------------------------------------------------------------
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { AllowlistTree, generateSecret, leafOf, type Hex } from "../src/lib/merkleTree";

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      args[key] = value;
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = args.out ?? ".";

  let secrets: Hex[];
  if (args.secrets && existsSync(args.secrets)) {
    secrets = JSON.parse(readFileSync(args.secrets, "utf8"));
    console.log(`Loaded ${secrets.length} existing member secrets from ${args.secrets}`);
  } else {
    const count = Number(args.count ?? 10);
    secrets = Array.from({ length: count }, () => generateSecret());
    console.log(`Generated ${count} fresh member secrets`);
  }

  const tree = new AllowlistTree(20);
  secrets.forEach((s) => tree.addMember(leafOf(s)));

  const root = tree.root();
  const rootPath = `${outDir}/allowlist-root.json`;
  const secretsPath = `${outDir}/allowlist-secrets.json`;

  writeFileSync(rootPath, JSON.stringify({ root, memberCount: secrets.length }, null, 2));
  writeFileSync(secretsPath, JSON.stringify(secrets, null, 2));

  console.log(`\nRoot to publish on-chain:\n  ${root}\n`);
  console.log(`Wrote:\n  ${rootPath}  (public — safe to share)`);
  console.log(`  ${secretsPath}  (PRIVATE — distribute one secret per member, never the whole file)`);
  console.log(`\nNext step:`);
  console.log(`  Call publishAllowlist("${root}") on the deployed contract, or pass`);
  console.log(`  this root as the constructor arg on first deploy.`);
}

main();
