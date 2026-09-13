import { PreprodRemoteConfig } from '../config.js';
import { MidnightWalletProvider } from '../midnight-wallet-provider.js';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledBBoardContractContract } from '@midnight-ntwrk/bboard-contract';
import { createLogger } from '../logger-utils.js';

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
  } catch (err) {
    console.error("Deployment failed:", err);
  } finally {
    await walletProvider.stop();
    await testEnv.shutdown();
    process.exit(0);
  }
}

main().catch(console.error);
