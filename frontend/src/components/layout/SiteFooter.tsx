import Link from "next/link";
import { BackendPill } from "./BackendPill";

export function SiteFooter() {
  return (
    <footer className="mt-20 px-5 pb-[calc(var(--dock-h)+2rem+env(safe-area-inset-bottom))] sm:px-8 md:pb-8 lg:px-10">
      <div className="flex flex-col gap-4 border-t border-line pt-6 text-small text-muted sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl">
          Free and open source under GPL-3.0. Stockfish runs in your browser. No accounts: your progress stays on this device.
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <BackendPill />
          <Link href="/credits" className="rounded font-semibold text-ink underline-offset-4 hover:underline">
            Credits
          </Link>
          <Link href="/settings" className="rounded font-semibold text-ink underline-offset-4 hover:underline">
            Settings
          </Link>
        </div>
      </div>
    </footer>
  );
}
