import { useCallback, useState, useSyncExternalStore } from "react";
import { generateSecret, type Hex } from "../lib/merkleTree";
import { ledger, type CheckAccessResult, type LedgerState } from "../utils/contract";

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() {
  listeners.forEach((l) => l());
}
function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function useLedgerState(): LedgerState {
  return useSyncExternalStore(subscribe, () => ledger.publicState());
}

export interface WalletState {
  connected: boolean;
  address: string | null;
}

/**
 * Wallet connection state. Wire this to the real Lace / Midnight wallet
 * connector (window.midnight.lace) before deploying — see
 * utils/contract.ts for the matching SDK call sites.
 */
function useWallet() {
  const [wallet, setWallet] = useState<WalletState>({ connected: false, address: null });

  const connect = useCallback(async () => {
    // MIDNIGHT_SDK_TODO: const api = await window.midnight.lace.enable();
    await new Promise((r) => setTimeout(r, 550));
    const fakeAddress =
      "mn_shield-addr1" +
      Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    setWallet({ connected: true, address: fakeAddress });
  }, []);

  const disconnect = useCallback(() => setWallet({ connected: false, address: null }), []);

  return { wallet, connect, disconnect };
}

export function useMidnight() {
  const state = useLedgerState();
  const { wallet, connect, disconnect } = useWallet();

  const enroll = useCallback((secrets: Hex[]) => {
    secrets.forEach((s) => ledger.enroll(s));
    notify();
  }, []);

  const createSecret = useCallback((): Hex => generateSecret(), []);

  const checkAccess = useCallback((secret: Hex): CheckAccessResult => {
    const result = ledger.checkAccess(secret);
    notify();
    return result;
  }, []);

  const reset = useCallback(() => {
    ledger.reset();
    notify();
  }, []);

  return { state, wallet, connect, disconnect, enroll, createSecret, checkAccess, reset };
}
