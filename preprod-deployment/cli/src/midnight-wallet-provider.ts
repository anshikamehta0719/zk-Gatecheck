/*
 * This file is part of example-bboard.
 * Copyright (C) Midnight Foundation
 * SPDX-License-Identifier: Apache-2.0
 * Licensed under the Apache License, Version 2.0 (the "License");
 * You may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { WebSocket } from 'ws';
import {
  type CoinPublicKey,
  DustSecretKey,
  type EncPublicKey,
  type FinalizedTransaction,
  LedgerParameters,
  ZswapSecretKeys,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { type MidnightProvider, type UnboundTransaction, type WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { ttlOneHour } from '@midnight-ntwrk/midnight-js-utils';
import { type WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import type { Logger } from 'pino';

import { getInitialShieldedState } from './wallet-utils.js';
import {
  type DustWalletOptions,
  type EnvironmentConfiguration,
  WalletFactory,
  WalletSeeds,
} from '@midnight-ntwrk/testkit-js';
import {
  DustWallet,
  ShieldedWallet,
  createKeystore,
  InMemoryTransactionHistoryStorage,
  WalletEntrySchema,
  mergeWalletEntries,
} from '@midnight-ntwrk/wallet-sdk';

type UnshieldedKeystore = {
  getPublicKey(): unknown;
  signData(payload: Uint8Array): string;
};

/**
 * Probes the indexer WebSocket for the current maximum ledger event ID.
 * This allows newly-created deployment wallets to fast-forward past millions of
 * historical blocks rather than streaming every historical block from genesis into RAM.
 */
async function probeLatestLedgerEventId(
  wsUrl: string,
  queryName: 'dustLedgerEvents' | 'zswapLedgerEvents',
): Promise<number> {
  return new Promise((resolve) => {
    try {
      const WsClass = (globalThis.WebSocket ?? WebSocket) as any;
      const ws = new WsClass(wsUrl, 'graphql-transport-ws');
      const timer = setTimeout(() => {
        try {
          ws.close();
        } catch {}
        resolve(0);
      }, 5000);

      const onOpen = () => {
        try {
          ws.send(JSON.stringify({ type: 'connection_init' }));
        } catch {}
      };

      const onMessage = (data: any) => {
        try {
          const raw = typeof data === 'string' ? data : data?.data ? data.data.toString() : data?.toString?.();
          const msg = JSON.parse(raw);
          if (msg.type === 'connection_ack') {
            ws.send(
              JSON.stringify({
                id: 'probe',
                type: 'subscribe',
                payload: {
                  query: `subscription { ${queryName} { id maxId } }`,
                },
              }),
            );
          } else if (msg.type === 'next') {
            clearTimeout(timer);
            const ev = msg.payload?.data?.[queryName];
            const maxId = Number(ev?.maxId ?? 0);
            try {
              ws.close();
            } catch {}
            resolve(maxId);
          }
        } catch {
          clearTimeout(timer);
          try {
            ws.close();
          } catch {}
          resolve(0);
        }
      };

      const onError = () => {
        clearTimeout(timer);
        try {
          ws.close();
        } catch {}
        resolve(0);
      };

      if (typeof ws.on === 'function') {
        ws.on('open', onOpen);
        ws.on('message', onMessage);
        ws.on('error', onError);
        ws.on('close', onError);
      } else {
        ws.onopen = onOpen;
        ws.onmessage = onMessage;
        ws.onerror = onError;
        ws.onclose = onError;
      }
    } catch {
      resolve(0);
    }
  });
}

/**
 * Provider class that implements wallet functionality for the Midnight network.
 * Handles transaction balancing, submission, and wallet state management.
 */
export class MidnightWalletProvider implements MidnightProvider, WalletProvider {
  logger: Logger;
  readonly env: EnvironmentConfiguration;
  readonly wallet: WalletFacade;
  readonly unshieldedKeystore: UnshieldedKeystore;
  readonly zswapSecretKeys: ZswapSecretKeys;
  readonly dustSecretKey: DustSecretKey;

  private constructor(
    logger: Logger,
    environmentConfiguration: EnvironmentConfiguration,
    wallet: WalletFacade,
    zswapSecretKeys: ZswapSecretKeys,
    dustSecretKey: DustSecretKey,
    unshieldedKeystore: UnshieldedKeystore,
  ) {
    this.logger = logger;
    this.env = environmentConfiguration;
    this.wallet = wallet;
    this.zswapSecretKeys = zswapSecretKeys;
    this.dustSecretKey = dustSecretKey;
    this.unshieldedKeystore = unshieldedKeystore;
  }

  getCoinPublicKey(): CoinPublicKey {
    return this.zswapSecretKeys.coinPublicKey;
  }

  getEncryptionPublicKey(): EncPublicKey {
    return this.zswapSecretKeys.encryptionPublicKey;
  }

  async balanceTx(tx: UnboundTransaction, ttl: Date = ttlOneHour()): Promise<FinalizedTransaction> {
    const recipe = await this.wallet.balanceUnboundTransaction(
      tx,
      { shieldedSecretKeys: this.zswapSecretKeys, dustSecretKey: this.dustSecretKey },
      { ttl, tokenKindsToBalance: ['unshielded', 'dust'] as any },
    );
    const signedRecipe = await this.wallet.signRecipe(recipe, (payload) => this.unshieldedKeystore.signData(payload));
    return this.wallet.finalizeRecipe(signedRecipe);
  }

  submitTx(tx: FinalizedTransaction): Promise<string> {
    return this.wallet.submitTransaction(tx);
  }

  async start(): Promise<void> {
    this.logger.debug('Starting unshielded and dust wallet...');
    await Promise.all([
      this.wallet.unshielded.start(),
      this.wallet.dust.start(this.dustSecretKey),
      (this.wallet as any).pendingTransactionsService?.start?.() ?? Promise.resolve(),
    ]);
  }

  async stop(): Promise<void> {
    await Promise.all([
      this.wallet.unshielded.stop(),
      this.wallet.dust.stop(),
      (this.wallet as any).submissionService?.close?.() ?? Promise.resolve(),
      (this.wallet as any).pendingTransactionsService?.stop?.() ?? Promise.resolve(),
    ]);
  }

  static async build(logger: Logger, env: EnvironmentConfiguration, seed?: string): Promise<MidnightWalletProvider> {
    const dustOptions: DustWalletOptions = {
      ledgerParams: LedgerParameters.initialParameters(),
      additionalFeeOverhead: env.walletNetworkId === 'undeployed' ? 500_000_000_000_000_000n : 1_000n,
      feeBlocksMargin: 5,
    };

    const walletConfig = {
      indexerClientConnection: {
        indexerHttpUrl: env.indexer,
        indexerWsUrl: env.indexerWS,
      },
      provingServerUrl: new URL(env.proofServer),
      networkId: env.walletNetworkId,
      relayURL: new URL(env.nodeWS),
      txHistoryStorage: new InMemoryTransactionHistoryStorage(WalletEntrySchema, mergeWalletEntries),
      costParameters: {
        feeBlocksMargin: 5,
      },
    };

    const dustConfig = {
      ...walletConfig,
      costParameters: {
        ledgerParams: dustOptions.ledgerParams,
        additionalFeeOverhead: dustOptions.additionalFeeOverhead,
        feeBlocksMargin: dustOptions.feeBlocksMargin,
      },
    };

    const seeds = seed ? WalletSeeds.fromMasterSeed(seed) : WalletSeeds.generateRandom();
    const keystore = createKeystore(seeds.unshielded, env.walletNetworkId as any);

    // Fast-forward probe: on live networks with millions of blocks (e.g. Preprod/Preview),
    // starting dust and shielded wallets from block 0 streams millions of ledger events
    // into Node heap and causes fatal OOM. By probing the current tip event ID, we fast-forward
    // the wallet's initial offset to the chain tip so it only syncs the latest ~10 blocks.
    let dustMaxId = 0;
    let zswapMaxId = 0;
    if (env.walletNetworkId === 'preprod' || env.walletNetworkId === 'preview') {
      try {
        [dustMaxId, zswapMaxId] = await Promise.all([
          probeLatestLedgerEventId(env.indexerWS, 'dustLedgerEvents'),
          probeLatestLedgerEventId(env.indexerWS, 'zswapLedgerEvents'),
        ]);
        logger.info(`Network tip probe: dustMaxId=${dustMaxId}, zswapMaxId=${zswapMaxId}`);
      } catch (e: any) {
        logger.warn(`Tip probe failed, continuing with standard sync: ${e.message}`);
      }
    }

    const unshieldedWallet = WalletFactory.createUnshieldedWallet(walletConfig as any, keystore);

    let dustWallet = WalletFactory.createDustWallet(walletConfig as any, seeds.dust, dustOptions);
    if (dustMaxId > 20) {
      logger.info(`Fast-forwarding DUST sync to chain tip (offset: ${dustMaxId - 10})`);
      const serialized = await dustWallet.serializeState();
      const parsed = JSON.parse(serialized);
      parsed.offset = String(dustMaxId - 10);
      dustWallet = (DustWallet(dustConfig as any) as any).restore(JSON.stringify(parsed));
    }

    let shieldedWallet = WalletFactory.createShieldedWallet(walletConfig as any, seeds.shielded);
    if (zswapMaxId > 20) {
      logger.info(`Fast-forwarding shielded sync to chain tip (offset: ${zswapMaxId - 10})`);
      const serialized = await shieldedWallet.serializeState();
      const parsed = JSON.parse(serialized);
      parsed.offset = String(zswapMaxId - 10);
      shieldedWallet = (ShieldedWallet(walletConfig as any) as any).restore(JSON.stringify(parsed));
    }

    const wallet = await WalletFactory.createWalletFacade(
      walletConfig as any,
      shieldedWallet,
      unshieldedWallet,
      dustWallet,
    );

    const initialState = await getInitialShieldedState(logger, wallet.shielded);
    logger.debug(`Wallet seed: ${seeds.masterSeed}, address: ${initialState.address.coinPublicKeyString()}`);

    return new MidnightWalletProvider(
      logger,
      env,
      wallet,
      ZswapSecretKeys.fromSeed(seeds.shielded),
      DustSecretKey.fromSeed(seeds.dust),
      keystore,
    );
  }
}
