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

import {
  type CoinPublicKey,
  type EncPublicKey,
  type FinalizedTransaction,
  LedgerParameters,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { type MidnightProvider, type UnboundTransaction, type WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { ttlOneHour } from '@midnight-ntwrk/midnight-js-utils';
import { type WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import type { Logger } from 'pino';

import { type DustWalletOptions, type EnvironmentConfiguration, FluentWalletBuilder } from '@midnight-ntwrk/testkit-js';

type UnshieldedKeystore = {
  getPublicKey(): unknown;
  signData(payload: Uint8Array): string;
};

/**
 * Provider class that implements wallet functionality for the Midnight network.
 * Uses FluentWalletBuilder.build() which auto-starts the wallet internally.
 */
export class MidnightWalletProvider implements MidnightProvider, WalletProvider {
  logger: Logger;
  readonly env: EnvironmentConfiguration;
  readonly wallet: WalletFacade;
  readonly unshieldedKeystore: UnshieldedKeystore;
  private _coinPublicKey: any;
  private _encPublicKey: any;

  private constructor(
    logger: Logger,
    environmentConfiguration: EnvironmentConfiguration,
    wallet: WalletFacade,
    unshieldedKeystore: UnshieldedKeystore,
    coinPublicKey: any,
    encPublicKey: any,
  ) {
    this.logger = logger;
    this.env = environmentConfiguration;
    this.wallet = wallet;
    this.unshieldedKeystore = unshieldedKeystore;
    this._coinPublicKey = coinPublicKey;
    this._encPublicKey = encPublicKey;
  }

  getCoinPublicKey(): CoinPublicKey {
    return this._coinPublicKey;
  }

  getEncryptionPublicKey(): EncPublicKey {
    return this._encPublicKey;
  }

  async balanceTx(tx: UnboundTransaction, ttl: Date = ttlOneHour()): Promise<FinalizedTransaction> {
    const recipe = await (this.wallet as any).balanceUnboundTransaction(tx, undefined, { ttl });
    const signedRecipe = await (this.wallet as any).signRecipe(recipe, (payload: Uint8Array) => this.unshieldedKeystore.signData(payload));
    return (this.wallet as any).finalizeRecipe(signedRecipe);
  }

  submitTx(tx: FinalizedTransaction): Promise<string> {
    return this.wallet.submitTransaction(tx);
  }

  // Wallet is already started via build()
  async start(): Promise<void> {
    this.logger.debug('Wallet already started via build()');
  }

  async stop(): Promise<void> {
    return this.wallet.stop();
  }

  static async build(logger: Logger, env: EnvironmentConfiguration, seed?: string): Promise<MidnightWalletProvider> {
    const dustOptions: DustWalletOptions = {
      ledgerParams: LedgerParameters.initialParameters(),
      additionalFeeOverhead: env.walletNetworkId === 'undeployed' ? 500_000_000_000_000_000n : 1_000n,
      feeBlocksMargin: 5,
    };
    const builder = FluentWalletBuilder.forEnvironment(env).withDustOptions(dustOptions);
    
    // Use build() which auto-starts the wallet — avoids seed format issues with buildWithoutStarting()
    const buildResult = seed
      ? await builder.withSeed(seed).build()
      : await builder.withRandomSeed().build();
    
    const { wallet, keystore } = buildResult as unknown as {
      wallet: WalletFacade;
      keystore: UnshieldedKeystore;
    };

    // Extract public keys from the wallet's shielded state
    let coinPublicKey: any;
    let encPublicKey: any;
    try {
      const state = await (wallet as any).shielded.state();
      coinPublicKey = state?.address?.coinPublicKey?.() ?? state?.coinPublicKey;
      encPublicKey = state?.address?.encryptionPublicKey?.() ?? state?.encryptionPublicKey;
      logger.info(`Wallet ready, coin public key available: ${!!coinPublicKey}`);
    } catch (e) {
      logger.warn(`Could not extract public keys from wallet state: ${e}`);
    }

    return new MidnightWalletProvider(
      logger,
      env,
      wallet,
      keystore,
      coinPublicKey,
      encPublicKey,
    );
  }
}
