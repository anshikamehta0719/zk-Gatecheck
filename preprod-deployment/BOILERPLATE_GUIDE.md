# ⚡ Fast Midnight Preprod Deployment Boilerplate

Use this turnkey boilerplate for any future Midnight Compact project. It packages all the hard-won optimizations (batch sync, WASM heap garbage collection, compliant credentials, automated DUST generation, and GitHub Actions CI runner) so you can deploy any Compact contract to Preprod in **15–20 minutes** instead of hours.

---

## 📁 What Files to Copy into Any New Project

```text
your-midnight-project/
├── .github/
│   └── workflows/
│       └── deploy.yml                # Turnkey GitHub Actions CI workflow
└── preprod-deployment/
    ├── docker-compose.proof-server.yml # Docker container for local proof server
    ├── package.json
    ├── infra/
    │   └── scripts/
    │       └── patch-wallet-sdk.mjs  # CRITICAL: WASM memory leak fix
    └── cli/
        ├── package.json
        ├── tsconfig.json
        └── src/
            ├── config.ts             # Preprod endpoints & proof server configuration
            ├── midnight-wallet-provider.ts # Wallet factory with batch sync (5,000/batch)
            ├── generate-dust.ts      # Automated NIGHT -> DUST registration
            └── launcher/
                └── deploy.ts         # Universal deploy launcher
```

---

## 🛠️ Key Files Reference

### 1. `.github/workflows/deploy.yml`
```yaml
name: Deploy Compact Contract to Midnight Preprod

on:
  workflow_dispatch:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install Compact Compiler Toolchain
        run: |
          npm install -g @midnight-ntwrk/compactc@0.31.1

      - name: Install Preprod Dependencies & Apply WASM Patch
        run: |
          cd preprod-deployment
          npm install
          node infra/scripts/patch-wallet-sdk.mjs

      - name: Setup 10GB Swap (Prevents Runner OOM)
        run: |
          sudo swapoff -a || true
          sudo rm -f /swapfile /swapfile_extra || true
          sudo fallocate -l 10G /swapfile_extra || sudo dd if=/dev/zero of=/swapfile_extra bs=1M count=10240
          sudo chmod 600 /swapfile_extra
          sudo mkswap /swapfile_extra
          sudo swapon /swapfile_extra

      - name: Deploy Contract to Preprod
        run: |
          cd preprod-deployment/cli
          npx tsx src/launcher/deploy-gatecheck.ts
        env:
          NODE_OPTIONS: "--max-old-space-size=8192 --expose-gc"
          WALLET_SEED: ${{ secrets.WALLET_SEED }}

      - name: Upload Deployment Artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: preprod-deployment-info
          path: |
            preprod-deployment/cli/deployment.json
            deployed_contract.json
```

---

### 2. `patch-wallet-sdk.mjs` (CRITICAL Memory Leak Fix)
*Without this, Node crashes with `Allocation failed - JavaScript heap out of memory (external memory pressure)` at ~2.5 minutes.*

```javascript
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coreWalletFile = path.resolve(
  __dirname,
  '../../node_modules/@midnight-ntwrk/wallet-sdk-dust-wallet/dist/v1/CoreWallet.js',
);

if (fs.existsSync(coreWalletFile)) {
  let content = fs.readFileSync(coreWalletFile, 'utf8');
  if (!content.includes('intermediateState.free')) {
    const newMethod = `    applyEventsWithChanges(wallet, secretKey, events, currentTime) {
        const oldState = wallet.state;
        const stateWithChanges = oldState.replayEventsWithChanges(secretKey, events);
        const intermediateState = stateWithChanges.state;
        const updatedState = intermediateState.processTtls(currentTime);
        const availableNonces = updatedState.utxos.map((utxo) => utxo.nonce);
        const changes = stateWithChanges.changes;
        try { stateWithChanges.free?.(); } catch {}
        try { intermediateState.free?.(); } catch {}
        try { oldState.free?.(); } catch {}
        if (typeof globalThis.gc === 'function' && Math.random() < 0.02) {
            try { globalThis.gc(); } catch {}
        }
        return [
            {
                ...wallet,
                state: updatedState,
                pendingDust: wallet.pendingDust.filter((t) => availableNonces.includes(t.nonce)),
            },
            changes,
        ];
    },`;
    
    const regex = /applyEventsWithChanges\(wallet, secretKey, events, currentTime\) \{[\s\S]*?return \[\s*\{\s*\.\.\.wallet,\s*state: updatedState,[\s\S]*?stateWithChanges\.changes,\s*\];\s*\},/;
    if (regex.test(content)) {
      content = content.replace(regex, newMethod);
      fs.writeFileSync(coreWalletFile, content, 'utf8');
      console.log('Successfully patched CoreWallet.js: freed Rust WASM objects!');
    }
  }
}
```

---

### 3. `midnight-wallet-provider.ts` (Fast Batch Sync)
Add `batchUpdates` to `walletConfig` to stream 5,000 events per batch with 0ms spacing:
```typescript
const walletConfig = {
  indexerClientConnection: {
    indexerHttpUrl: env.indexer,
    indexerWsUrl: env.indexerWS,
  },
  provingServerUrl: new URL(env.proofServer),
  networkId: env.walletNetworkId,
  relayURL: new URL(env.nodeWS),
  txHistoryStorage: new NoOpTransactionHistoryStorage(),
  costParameters: {
    feeBlocksMargin: 5,
  },
  batchUpdates: {
    size: 5000,
    timeout: 10,
    spacing: 0,
  },
};
```

---

### 4. LevelDB Storage Password Requirement
Always use a password with **at least 3 character classes** (uppercase, lowercase, number, symbol):
```typescript
// ✅ Good:
const storagePassword = "TempPassword123!Secure";

// ❌ Bad (throws PasswordValidationError):
const storagePassword = "temporary-password";
```

---

## ⚡ Step-by-Step for Any New Project

1. **Copy the `preprod-deployment/` folder and `.github/workflows/deploy.yml`** into your new repo.
2. In `preprod-deployment/cli/src/launcher/deploy-gatecheck.ts`, change the contract import and constructor arguments to match your new Compact contract.
3. In your new GitHub repo: **Settings → Secrets and variables → Actions**, add:
   - Name: `WALLET_SEED`
   - Value: *(your 64-character hex wallet seed)*
4. Push to `main` (or click **Run workflow** in Actions).
5. The contract deploys automatically, creates `deployment.json`, and prints your verifiable contract address and explorer link!
