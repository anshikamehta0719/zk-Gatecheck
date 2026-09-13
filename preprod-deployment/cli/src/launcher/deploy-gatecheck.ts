import { PreprodRemoteConfig } from '../config.ts';
import { MidnightWalletProvider } from '../midnight-wallet-provider.ts';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledBBoardContractContract } from '@midnight-ntwrk/bboard-contract';
import { createLogger } from '../logger-utils.ts';
import { syncWallet, waitForUnshieldedFunds, getUnshieldedAddress } from '../wallet-utils.ts';
import { generateDust } from '../generate-dust.ts';
import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';

async function main() {
  console.log("Starting deployment to Preprod...");
  const seed = process.env.WALLET_SEED;
  if (!seed) throw new Error("WALLET_SEED environment variable is required");
  
  const config = new PreprodRemoteConfig();
  const logger = await createLogger(config.logDir, false);
  const testEnv = config.getEnvironment(logger);
  console.log("Starting environment...");
  const envConfiguration = await testEnv.start();
  
  console.log("Building wallet provider...");
  const walletProvider = await MidnightWalletProvider.build(logger, envConfiguration, seed);
  await walletProvider.start();
  
  const walletAddress = await getUnshieldedAddress(logger, walletProvider.wallet);
  console.log(`Wallet Address: ${walletAddress}`);

  console.log("Syncing wallet with Preprod...");
  let syncedState = await syncWallet(logger, walletProvider.wallet, 2000, (detail) => console.log(detail), 300000);
  
  let unshieldedState = syncedState.unshielded;
  let nightBalance = unshieldedState.balances[unshieldedToken().raw] ?? 0n;
  console.log(`Current tNIGHT balance: ${nightBalance}`);

  if (nightBalance === 0n) {
    console.log("Wallet has 0 tNIGHT. Requesting funds from faucet...");
    unshieldedState = await waitForUnshieldedFunds(
      logger,
      walletProvider.wallet,
      envConfiguration,
      unshieldedToken(),
      true,
      2000,
      { timeoutMs: 300000 }
    );
    nightBalance = unshieldedState.balances[unshieldedToken().raw] ?? 0n;
    console.log(`Received funds! New balance: ${nightBalance}`);
  }

  console.log("Checking / Registering DUST generation...");
  const dustTx = await generateDust(logger, seed, unshieldedState, walletProvider.wallet);
  if (dustTx) {
    console.log(`Registered DUST generation (tx: ${dustTx}). Syncing wallet...`);
    await syncWallet(logger, walletProvider.wallet, 2000, undefined, 300000);
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
    
    console.log("=========================================");
    console.log("SUCCESS! Contract Deployed!");
    console.log("Contract Address:", deployed.deployTxData.public.contractAddress);
    console.log("=========================================");
    success = true;
  } catch (err) {
    console.error("Deployment failed:", err);
  } finally {
    await walletProvider.stop();
    await testEnv.shutdown();
    process.exit(success ? 0 : 1);
  }
}

main().catch(console.error);
