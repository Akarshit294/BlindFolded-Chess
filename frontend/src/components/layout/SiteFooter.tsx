import Link from "next/link";
import { BackendPill } from "./BackendPill";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-ivory-100/[0.06] pb-24 md:pb-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 text-xs text-ivory-500 sm:flex-row sm:px-6">
        <p>
          Free and open source under <span className="text-ivory-300">GPL-3.0</span>. Engine: Stockfish. No accounts, no tracking — your progress
          stays in this browser.
        </p>
        <div className="flex items-center gap-4">
          <BackendPill />
          <Link href="/credits" className="rounded text-ivory-400 underline-offset-4 hover:text-ivory-200 hover:underline">
            Credits
          </Link>
          <Link href="/settings" className="rounded text-ivory-400 underline-offset-4 hover:text-ivory-200 hover:underline">
            Settings
          </Link>
        </div>
      </div>
    </footer>
  );
}
