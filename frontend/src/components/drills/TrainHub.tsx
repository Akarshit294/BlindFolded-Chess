"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/Display";
import { IconPuzzle } from "@/components/ui/Icons";
import { getRatings, listSessions, onProgressChange } from "@/lib/storage/db";
import type { DrillId } from "@/lib/storage/types";
import { DRILLS } from "./catalog";
import { DrillVisual } from "./DrillVisual";

type Progress = Partial<Record<DrillId, { rating: number; sessions: number; best: number }>>;

/** Last level used per drill (one tap starts there). */
export function rememberedLevel(id: DrillId): number {
  try {
    return Math.max(1, Number(localStorage.getItem(`bf:drill-level:${id}`)) || 1);
  } catch {
    return 1;
  }
}

export function TrainHub() {
  const [progress, setProgress] = useState<Progress>({});
  const [levels, setLevels] = useState<Partial<Record<DrillId, number>>>({});

  useEffect(() => {
    const load = async () => {
      const [ratings, sessions] = await Promise.all([getRatings(), listSessions()]);
      const p: Progress = {};
      for (const s of sessions) {
        const cur = p[s.drill] ?? { rating: ratings.drills[s.drill]?.rating ?? 1200, sessions: 0, best: 0 };
        cur.sessions += 1;
        cur.best = Math.max(cur.best, Math.round(s.accuracy * 100));
        p[s.drill] = cur;
      }
      setProgress(p);
      setLevels(Object.fromEntries(DRILLS.map((d) => [d.id, rememberedLevel(d.id)])));
    };
    void load();
    return onProgressChange(() => void load());
  }, []);

  return (
    <div className="px-5 pb-10 pt-6 sm:px-8 lg:px-12 lg:pt-10">
      <PageHeader thin="Train" bold="your vision" lead="Short, focused drills for the skills blindfold chess is made of. Tap one to start; ten minutes a day beats an hour once a week." />
      <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
        {DRILLS.map((d) => {
          const p = progress[d.id];
          const lvl = levels[d.id] ?? 1;
          return (
            <li key={d.id} className="group relative" data-testid={`drill-card-${d.id}`}>
              <div className="glass-panel flex h-full flex-col rounded-panel p-5 transition-transform duration-300 ease-out group-hover:-translate-y-1 group-focus-within:-translate-y-1">
                <div className="flex h-28 items-center justify-center rounded-control bg-sunken/60">
                  <DrillVisual id={d.id} />
                </div>
                <h2 className="mt-5 text-title font-semibold text-ink">
                  <Link
                    href={`/train/${d.id}?go=1`}
                    className="outline-none after:absolute after:inset-0 after:rounded-panel after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-[var(--focus)]"
                  >
                    {d.title}
                  </Link>
                </h2>
                <p className="mt-1.5 flex-1 text-small text-muted">{d.tagline}</p>
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3 text-small">
                  {p ? (
                    <span className="text-muted">
                      Rating <span className="font-semibold tabular text-ink">{p.rating}</span>, best <span className="font-semibold tabular text-ink">{p.best}%</span>
                    </span>
                  ) : (
                    <span className="text-muted">Not started yet</span>
                  )}
                  <Link href={`/train/${d.id}`} className="relative z-10 -my-2.5 rounded-full px-1 py-2.5 font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                    Level {lvl}
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
        <li className="group relative" data-testid="drill-card-puzzles">
          <div className="glass-panel flex h-full flex-col rounded-panel p-5 transition-transform duration-300 ease-out group-hover:-translate-y-1 group-focus-within:-translate-y-1">
            <div className="flex h-28 items-center justify-center rounded-control bg-sunken/60 text-ink" aria-hidden="true">
              <IconPuzzle size={40} strokeWidth={1.4} />
            </div>
            <h2 className="mt-5 text-title font-semibold text-ink">
              <Link href="/puzzles" className="outline-none after:absolute after:inset-0 after:rounded-panel after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-[var(--focus)]">
                Blindfold puzzles
              </Link>
            </h2>
            <p className="mt-1.5 flex-1 text-small text-muted">The position is given only as text. Find the mate in one to three, or the winning move, and answer in SAN.</p>
            <div className="mt-4 border-t border-line pt-3 text-small text-muted">Opens straight onto a puzzle</div>
          </div>
        </li>
      </ul>
    </div>
  );
}
