import type { ReactNode } from "react";
import { CodeXml } from "lucide-react";
import { GateMark } from "./GateMark";
import { WalletConnect } from "./WalletConnect";
import type { WalletState } from "../hooks/useMidnight";

interface LayoutProps {
  children: ReactNode;
  wallet: WalletState;
  onConnect: () => Promise<void>;
  onDisconnect: () => void;
}

const REPO_URL = "https://github.com/your-org/zk-gatecheck";

export function Layout({ children, wallet, onConnect, onDisconnect }: LayoutProps) {
  return (
    <div className="min-h-screen bg-ink text-ink-text">
      <header className="sticky top-0 z-20 border-b border-line-soft bg-ink/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="#top" className="flex items-center gap-2.5">
            <GateMark size={26} />
            <span className="font-display text-[17px] font-semibold tracking-tight">Gatecheck</span>
          </a>
          <nav className="hidden items-center gap-7 text-sm text-ink-muted md:flex">
            <a href="#how-it-works" className="transition-colors hover:text-ink-text">
              How it works
            </a>
            <a href="#demo" className="transition-colors hover:text-ink-text">
              Live demo
            </a>
            <a href="#privacy-model" className="transition-colors hover:text-ink-text">
              Privacy model
            </a>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 transition-colors hover:text-ink-text"
            >
              <CodeXml size={15} />
              Source
            </a>
          </nav>
          <WalletConnect wallet={wallet} onConnect={onConnect} onDisconnect={onDisconnect} />
        </div>
      </header>

      <main id="top">{children}</main>

      <footer className="border-t border-line-soft">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 text-sm text-ink-faint md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <GateMark size={18} />
            <span>Gatecheck — built on Midnight</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-ink-muted">
              GitHub
            </a>
            <a href="https://docs.midnight.network" target="_blank" rel="noreferrer" className="hover:text-ink-muted">
              Midnight docs
            </a>
            <a href="/docs/USAGE.md" className="hover:text-ink-muted">
              Usage guide
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
