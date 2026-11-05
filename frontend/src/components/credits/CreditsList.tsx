import { PageHeader } from "@/components/ui/Display";
import { ASSET_CREDITS, SOFTWARE_CREDITS, type Credit } from "@/data/credits";

function List({ items }: { items: Credit[] }) {
  return (
    <ul className="glass-panel divide-y divide-line overflow-hidden rounded-panel">
      {items.map((c) => (
        <li key={c.name} className="grid grid-cols-1 gap-1 px-5 py-4 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)_auto] sm:items-center sm:gap-5">
          <a href={c.url} target="_blank" rel="noreferrer noopener" className="font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
            {c.name}
          </a>
          <span className="text-small text-fg">
            {c.what}
            {c.author ? <span className="text-muted">, {c.author}</span> : null}
          </span>
          <span className="glass-well w-fit rounded-full px-3 py-0.5 text-caption font-semibold text-ink">{c.license}</span>
        </li>
      ))}
    </ul>
  );
}

export function CreditsList() {
  return (
    <div className="px-5 pb-10 pt-6 sm:px-8 lg:px-12 lg:pt-10">
      <PageHeader
        thin="Open"
        bold="credits"
        lead="Blindfold Chess is free software under the GNU GPL v3, because it ships Stockfish. It stands on the shoulders of these projects. The 3D pieces, the melting board, the Lumen piece set, the icons, the sounds (synthesised live) and the design were made for this project."
      />
      <h2 className="mb-4 mt-12 text-title font-semibold text-ink">Engine, data and assets</h2>
      <List items={ASSET_CREDITS} />
      <h2 className="mb-4 mt-10 text-title font-semibold text-ink">Software</h2>
      <List items={SOFTWARE_CREDITS} />
      <p className="mt-8 text-small text-muted">
        Not affiliated with lichess.org, chess.com or the Stockfish project. The full list, with versions, is in CREDITS.md in the{" "}
        <a className="font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink" href="https://www.gnu.org/licenses/gpl-3.0.html">
          GPL-3.0
        </a>{" "}
        source repository.
      </p>
    </div>
  );
}
