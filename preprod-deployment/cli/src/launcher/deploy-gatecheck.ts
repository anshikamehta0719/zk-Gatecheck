import { WebSocket } from 'ws';
globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

import fs from 'node:fs';
import path from 'node:path';
import { PreprodRemoteConfig } from '../config.js';
import { MidnightWalletProvider } from '../midnight-wallet-provider.js';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledBBoardContractContract } from '@midnight-ntwrk/bboard-contract';
import { createLogger } from '../logger-utils.js';
import { getUnshieldedAddress } from '../wallet-utils.js';
import { generateDust } from '../generate-dust.js';
import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { FaucetClient } from '@midnight-ntwrk/testkit-js';
import * as Rx from 'rxjs';

async function main() {
  console.log("Starting deployment to Preprod...");
  const seed = process.env.WALLET_SEED;
  if (!seed) throw new Error("WALLET_SEED environment variable is required");
  
  const config = new PreprodRemoteConfig();
  const logger = await createLogger(config.logDir, false);
  const testEnv = config.getEnvironment(logger);
  console.log("Starting environment...");
  const envConfiguration = await testEnv.start();
  
  console.log("Building wallet provider (with chain-tip fast forward)...");
  const walletProvider = await MidnightWalletProvider.build(logger, envConfiguration, seed);
  await walletProvider.start();
  
  const walletAddress = await getUnshieldedAddress(logger, walletProvider.wallet);
  console.log(`Wallet Address: ${walletAddress}`);

  console.log("Syncing unshielded wallet with Preprod...");
  let unshieldedState = await walletProvider.wallet.unshielded.waitForSyncedState();
  let nightBalance = unshieldedState.balances[unshieldedToken().raw] ?? 0n;
  console.log(`Current tNIGHT balance: ${nightBalance}`);

  if (nightBalance === 0n) {
    console.log("Wallet has 0 tNIGHT. Requesting funds from faucet...");
    if (envConfiguration.faucet) {
      try {
        await new FaucetClient(envConfiguration.faucet, logger).requestTokens(walletAddress);
        console.log("Faucet request sent successfully. Waiting for tokens...");
      } catch (e: any) {
        console.warn(`Faucet request warning: ${e.message}`);
      }
    }
    
    unshieldedState = await Rx.firstValueFrom(
      walletProvider.wallet.unshielded.state.pipe(
        Rx.throttleTime(5000),
        Rx.tap((state) => {
          const bal = state.balances[unshieldedToken().raw] ?? 0n;
          console.log(`Waiting for tokens... current balance: ${bal} tNIGHT`);
        }),
        Rx.filter((state) => (state.balances[unshieldedToken().raw] ?? 0n) > 0n),
        Rx.timeout(300000)
      )
    );
    nightBalance = unshieldedState.balances[unshieldedToken().raw] ?? 0n;
    console.log(`Received funds! New balance: ${nightBalance} tNIGHT`);
  }

  console.log("Syncing DUST wallet with Preprod...");
  const dustSub = walletProvider.wallet.dust.state.pipe(
    Rx.throttleTime(5000),
  ).subscribe((s) => {
    const p = s.progress as any;
    console.log(`DUST sync progress: applied=${p?.appliedIndex}, highest=${p?.highestIndex}`);
  });
  await walletProvider.wallet.dust.waitForSyncedState(100n);
  dustSub.unsubscribe();

  console.log("Checking / Registering DUST generation...");
  const dustTx = await generateDust(logger, seed, unshieldedState, walletProvider.wallet);
  if (dustTx) {
    console.log(`Registered DUST generation (tx: ${dustTx}). Waiting for dust state to sync...`);
    await walletProvider.wallet.dust.waitForSyncedState(100n);
  } else {
    console.log("DUST already registered or available.");
  }

  console.log("Initializing providers...");
  const zkConfigProvider = new NodeZkConfigProvider(config.zkConfigPath);
  const storagePassword = "temporary-password";
  
  const providers = {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: config.privateStateStoreName,
      signingKeyStoreName: `${config.privateStateStoreName}-signing-keys`,
      privateStoragePasswordProvider: () => storagePassword,
      accountId: seed,
    }),
    publicDataProvider: indexerPublicDataProvider(envConfiguration.indexer, envConfiguration.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(envConfiguration.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
  
  console.log("Deploying contract...");
  let success = false;
  try {
    const initialRoot = new Uint8Array(32); // 32 bytes of zeros
    
    const deployed = await deployContract(providers, {
        compiledContract: CompiledBBoardContractContract,
        args: [initialRoot]
    });
    
    const contractAddress = deployed.deployTxData.public.contractAddress;
    console.log("================================================================================");
    console.log("🎉 SUCCESS! CONTRACT DEPLOYED TO PREPROD!");
    console.log("CONTRACT_ADDRESS=" + contractAddress);
    console.log("Contract Address:", contractAddress);
    console.log("Explorer:", `https://preprod.midnight.network/contract/${contractAddress}`);
    console.log("================================================================================");

    const deploymentInfo = {
      network: "preprod",
      contractAddress,
      explorerUrl: `https://preprod.midnight.network/contract/${contractAddress}`,
      indexer: envConfiguration.indexer,
      node: envConfiguration.node,
      deployedAt: new Date().toISOString(),
    };

    fs.writeFileSync('deployment.json', JSON.stringify(deploymentInfo, null, 2));
    fs.writeFileSync('../../deployed_contract.json', JSON.stringify(deploymentInfo, null, 2));
    success = true;
  } catch (err) {
    console.error("Deployment failed:", err);
  } finally {
    await walletProvider.stop();
    await testEnv.shutdown();
    process.exit(success ? 0 : 1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
