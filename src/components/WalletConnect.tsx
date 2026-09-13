import { useState } from "react";
import { Wallet, LogOut, Loader2 } from "lucide-react";
import type { WalletState } from "../hooks/useMidnight";

interface WalletConnectProps {
  wallet: WalletState;
  onConnect: () => Promise<void>;
  onDisconnect: () => void;
}

export function WalletConnect({ wallet, onConnect, onDisconnect }: WalletConnectProps) {
  const [connecting, setConnecting] = useState(false);

  if (wallet.connected && wallet.address) {
    return (
      <button
        onClick={onDisconnect}
        className="group flex items-center gap-2 rounded-full border border-line bg-ink-panel px-3.5 py-2 font-data text-xs text-ink-muted transition-colors hover:border-veil-dim hover:text-ink-text"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-moon pulse-soft" />
        {wallet.address.slice(0, 14)}…
        <LogOut size={13} className="opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    );
  }

  return (
    <button
      onClick={async () => {
        setConnecting(true);
        await onConnect();
        setConnecting(false);
      }}
      disabled={connecting}
      className="flex items-center gap-2 rounded-full bg-veil px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-veil-glow disabled:opacity-70"
    >
      {connecting ? (
        <>
          <Loader2 size={15} className="animate-spin" />
          Connecting
        </>
      ) : (
        <>
          <Wallet size={15} />
          Connect Lace wallet
        </>
      )}
    </button>
  );
}
