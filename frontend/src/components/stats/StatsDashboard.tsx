"use client";
import { motion } from "motion/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DRILLS } from "@/components/drills/catalog";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { EmptyState } from "@/components/ui/Blocks";
import { Button, LinkButton } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Controls";
import { PageHeader } from "@/components/ui/Display";
import { IconDownload, IconTrash, IconUpload } from "@/components/ui/Icons";
import { Modal } from "@/components/ui/Modal";
import { getLevel } from "@/lib/engine/levels";
import { describeResult } from "@/lib/game/result";
import {
  activityGrid,
  activityTimestamps,
  blindfoldRatingSeries,
  drillAccuracySeries,
  gameAccuracySeries,
  gameTotals,
  puzzleRatingSeries,
  puzzleTotals,
  streaks,
  trainingTime,
} from "@/lib/stats/aggregate";
import { clearProgress, exportProgress, getRatings, importProgress, listGames, listPuzzleAttempts, listSessions, onProgressChange } from "@/lib/storage/db";
import type { DrillSession, GameRecord, PuzzleAttempt, Ratings } from "@/lib/storage/types";
import { cn } from "@/lib/utils/cn";
import { formatDuration, formatRelativeDay, plural } from "@/lib/utils/format";
import { BarList, EmptyChart, Heatmap, LineChart, SERIES_COLORS, Sparkline } from "./charts";

type Data = { games: GameRecord[]; sessions: DrillSession[]; puzzles: PuzzleAttempt[]; ratings: Ratings };

// The replay brings in the board, chess.js and the engine client: load it on demand
// (warmed up when the pointer or focus reaches a Replay button).
const ReplayModal = dynamic(() => import("./ReplayModal").then((m) => m.ReplayModal));
const preloadReplay = () => void import("./ReplayModal");

const GOAL_NAMES: Record<string, string> = { mate1: "Mate in 1", mate2: "Mate in 2", mate3: "Mate in 3", win: "Winning move" };
const VIS_NAMES: Record<string, string> = { full: "Full", ghost: "Ghost", silhouette: "Silhouette", empty: "Empty", blind: "Blindfold" };

function useProgress(): Data | null {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    const load = async () => {
      const [games, sessions, puzzles, ratings] = await Promise.all([listGames(), listSessions(), listPuzzleAttempts(), getRatings()]);
      setData({ games, sessions, puzzles, ratings });
    };
    void load();
    return onProgressChange(() => void load());
  }, []);
  return data;
}

function StatTile({ label, value, sub, delta }: { label: string; value: ReactNode; sub?: ReactNode; delta?: number | null }) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } } }}
      className="glass-panel flex flex-col justify-between rounded-panel p-4 sm:p-5"
    >
      <div className="text-small text-muted">{label}</div>
      <div className="mt-3 font-display text-[2rem] font-bold leading-none tabular text-ink">{value}</div>
      {sub || (delta !== undefined && delta !== null) ? (
        <div className="mt-2 flex items-center gap-2 text-caption text-muted">
          {delta !== undefined && delta !== null && delta !== 0 ? (
            <span className={cn("font-semibold", delta > 0 ? "text-good" : "text-bad")}>
              {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}
            </span>
          ) : null}
          {sub}
        </div>
      ) : null}
    </motion.div>
  );
}

const HEADER = { thin: "Your", bold: "progress", lead: "Stored only in this browser. Export it to keep a backup or move devices." };

export function StatsDashboard() {
  const data = useProgress();
  const [confirmReset, setConfirmReset] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<unknown>(null);
  const [replay, setReplay] = useState<GameRecord | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const doExport = async () => {
    const blob = new Blob([JSON.stringify(await exportProgress(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `blindfold-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (file: File) => {
    try {
      setPendingImport(JSON.parse(await file.text()));
    } catch {
      setImportMsg("That file isn't valid JSON.");
    }
  };

  const runImport = async (mode: "merge" | "replace") => {
    try {
      const r = await importProgress(pendingImport, mode);
      setImportMsg(`Imported ${plural(r.games, "game")}, ${plural(r.sessions, "drill session")} and ${plural(r.puzzles, "puzzle attempt")}.`);
    } catch (e) {
      setImportMsg(e instanceof Error ? e.message : "Import failed.");
    }
    setPendingImport(null);
  };

  const derived = useMemo(() => {
    if (!data) return null;
    const { games, sessions, puzzles, ratings } = data;
    const finished = games.filter((g) => g.result);
    const bSeries = blindfoldRatingSeries(games);
    const pSeries = puzzleRatingSeries(puzzles);
    return {
      totals: gameTotals(games),
      ptotals: puzzleTotals(puzzles),
      streak: streaks(games, sessions, puzzles),
      time: trainingTime(finished, sessions, puzzles),
      grid: activityGrid(activityTimestamps(games, sessions, puzzles), 16),
      bSeries,
      pSeries,
      accSeries: gameAccuracySeries(games),
      bDelta: bSeries.length >= 2 ? bSeries[bSeries.length - 1]!.v - bSeries[bSeries.length - 2]!.v : null,
      pDelta: pSeries.length >= 2 ? pSeries[pSeries.length - 1]!.v - pSeries[pSeries.length - 2]!.v : null,
      ratings,
      recent: [...finished].sort((a, b) => b.startedAt - a.startedAt).slice(0, 12),
      empty: games.length === 0 && sessions.length === 0 && puzzles.length === 0,
    };
  }, [data]);

  if (!data || !derived) {
    return (
      <div className="px-5 pb-10 pt-6 sm:px-8 lg:px-12 lg:pt-10" aria-busy="true">
        <PageHeader {...HEADER} />
        <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton h-32 rounded-panel" />
          ))}
        </div>
        <div className="skeleton mt-6 h-72 rounded-panel" />
      </div>
    );
  }

  const { totals, ptotals, streak, ratings } = derived;

  return (
    <div className="px-5 pb-10 pt-6 sm:px-8 lg:px-12 lg:pt-10">
      <PageHeader
        {...HEADER}
        actions={
          <>
            <Button size="sm" onClick={() => void doExport()} icon={<IconDownload size={15} />} data-testid="export">
              Export
            </Button>
            <Button size="sm" onClick={() => fileRef.current?.click()} icon={<IconUpload size={15} />} data-testid="import">
              Import
            </Button>
            <Button size="sm" variant="danger" onClick={() => setConfirmReset(true)} icon={<IconTrash size={15} />}>
              Reset
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              data-testid="import-file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = "";
              }}
            />
          </>
        }
      />
      {importMsg ? (
        <p className="mt-4 text-small font-semibold text-ink" role="status" data-testid="import-message">
          {importMsg}
        </p>
      ) : null}

      {derived.empty ? (
        <Panel className="mt-10">
          <EmptyState
            title="Nothing here yet"
            text="Play a blindfold game, run a drill or solve a puzzle: your ratings, streaks and charts grow from there."
            actions={
              <>
                <LinkButton href="/play?new=1" variant="primary">
                  Play a game
                </LinkButton>
                <LinkButton href="/train">Start a drill</LinkButton>
                <LinkButton href="/puzzles">Solve a puzzle</LinkButton>
              </>
            }
          />
        </Panel>
      ) : null}

      {/* KPI row */}
      <motion.div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}>
        <StatTile label="Blindfold rating" value={<AnimatedNumber value={ratings.blindfold.rating} />} delta={derived.bDelta} sub={<>peak {ratings.blindfold.peak}</>} />
        <StatTile label="Puzzle rating" value={<AnimatedNumber value={ratings.puzzles.rating} />} delta={derived.pDelta} sub={<>peak {ratings.puzzles.peak}</>} />
        <StatTile label="Current streak" value={<><AnimatedNumber value={streak.current} /><span className="ml-1 font-sans text-base font-semibold text-muted">{streak.current === 1 ? "day" : "days"}</span></>} sub={<>best {streak.best}</>} />
        <StatTile label="Training time" value={formatDuration(derived.time)} sub={<>{plural(data.sessions.length, "drill session")}</>} />
        <StatTile label="Games" value={<AnimatedNumber value={totals.played} />} sub={<>{totals.wins} won, {totals.draws} drawn, {totals.losses} lost</>} />
        <StatTile
          label="Puzzles solved"
          value={<><AnimatedNumber value={ptotals.attempts ? Math.round((ptotals.solved / ptotals.attempts) * 100) : 0} />%</>}
          sub={<>{ptotals.solved} of {ptotals.attempts}</>}
        />
      </motion.div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel className="p-5 sm:p-6">
          <h2 className="mb-4 text-title font-semibold text-ink">Ratings over time</h2>
          {derived.bSeries.length || derived.pSeries.length ? (
            <LineChart
              title="Ratings over time"
              series={[
                { id: "blindfold", label: "Blindfold", color: SERIES_COLORS[0], points: derived.bSeries },
                { id: "puzzles", label: "Puzzles", color: SERIES_COLORS[1], points: derived.pSeries },
              ]}
            />
          ) : (
            <EmptyChart text="Rated games and puzzles will draw your rating curve here." />
          )}
        </Panel>
        <Panel className="p-5 sm:p-6">
          <h2 className="mb-4 text-title font-semibold text-ink">Activity</h2>
          <Heatmap days={derived.grid} title="Daily activity, last 16 weeks" />
          <div className="mt-4 grid grid-cols-2 gap-3 text-small">
            <div className="glass-well rounded-control p-3">
              <div className="text-muted">Current streak</div>
              <div className="mt-0.5 font-semibold tabular text-ink">{plural(streak.current, "day")}</div>
            </div>
            <div className="glass-well rounded-control p-3">
              <div className="text-muted">Longest streak</div>
              <div className="mt-0.5 font-semibold tabular text-ink">{plural(streak.best, "day")}</div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel className="p-5 sm:p-6">
          <h2 className="text-title font-semibold text-ink">Drills</h2>
          <p className="mb-4 mt-1 text-small text-muted">Rating per drill, with accuracy over your last sessions.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-small" data-testid="drill-table">
              <caption className="sr-only">Drill ratings and accuracy</caption>
              <thead className="text-muted">
                <tr>
                  <th scope="col" className="py-2 font-semibold">Drill</th>
                  <th scope="col" className="py-2 text-right font-semibold">Rating</th>
                  <th scope="col" className="py-2 text-right font-semibold">Sessions</th>
                  <th scope="col" className="py-2 text-right font-semibold">Best</th>
                  <th scope="col" className="py-2 pl-4 font-semibold">Accuracy trend</th>
                </tr>
              </thead>
              <tbody>
                {DRILLS.map((d) => {
                  const list = data.sessions.filter((x) => x.drill === d.id);
                  const r = ratings.drills[d.id];
                  const best = list.length ? Math.max(...list.map((x) => Math.round(x.accuracy * 100))) : null;
                  const series = drillAccuracySeries(data.sessions, d.id);
                  return (
                    <tr key={d.id} className="border-t border-line">
                      <td className="py-2.5">
                        <Link href={`/train/${d.id}`} className="-my-2 inline-block py-2 font-semibold text-ink underline decoration-transparent underline-offset-4 hover:decoration-ink">
                          {d.title}
                        </Link>
                      </td>
                      <td className="py-2.5 text-right tabular text-ink">{r ? r.rating : "None"}</td>
                      <td className="py-2.5 text-right tabular text-fg">{list.length || "None"}</td>
                      <td className="py-2.5 text-right tabular text-fg">{best !== null ? `${best}%` : "None"}</td>
                      <td className="py-2.5 pl-4">
                        <Sparkline points={series} label={`${d.title} accuracy over the last ${Math.min(12, series.length)} sessions`} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel className="p-5 sm:p-6">
          <h2 className="text-title font-semibold text-ink">Puzzles by goal</h2>
          <p className="mb-4 mt-1 text-small text-muted">Share solved, by puzzle type.</p>
          {ptotals.attempts ? (
            <BarList
              title="Puzzle solve rate by goal"
              format={(v) => `${Math.round(v)}%`}
              items={ptotals.byGoal.map((g) => ({
                label: GOAL_NAMES[g.goal] ?? g.goal,
                value: g.attempts ? (g.solved / g.attempts) * 100 : 0,
                detail: `${g.solved}/${g.attempts}`,
              }))}
            />
          ) : (
            <EmptyChart text="Solve a few puzzles to see your strengths.">
              <LinkButton href="/puzzles" size="sm">
                Open puzzles
              </LinkButton>
            </EmptyChart>
          )}
        </Panel>
      </div>

      <Panel className="mt-6 p-5 sm:p-6">
        <h2 className="text-title font-semibold text-ink">Game accuracy</h2>
        <p className="mb-4 mt-1 text-small text-muted">Engine-measured accuracy of your moves in analysed games.</p>
        {derived.accSeries.length ? (
          <LineChart title="Game accuracy over time" yDomain={[0, 100]} yFormat={(v) => `${Math.round(v)}%`} series={[{ id: "acc", label: "Accuracy", color: SERIES_COLORS[0], points: derived.accSeries }]} height={180} />
        ) : (
          <EmptyChart text="Finish a game to see its accuracy here." />
        )}
      </Panel>

      <Panel className="mt-6 p-5 sm:p-6">
        <h2 className="mb-4 text-title font-semibold text-ink">Recent games</h2>
        {derived.recent.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-small" data-testid="games-table">
              <caption className="sr-only">Recent games</caption>
              <thead className="text-muted">
                <tr>
                  {["When", "Opponent", "Mode", "Visibility", "Result", "Accuracy", "Peeks", "Illegal"].map((h) => (
                    <th key={h} scope="col" className="py-2 font-semibold">
                      {h}
                    </th>
                  ))}
                  <th scope="col" className="py-2">
                    <span className="sr-only">Replay</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {derived.recent.map((g) => {
                  const r = describeResult(g.result!, g.config.playerColor);
                  const acc = g.analysis ? (g.config.playerColor === "w" ? g.analysis.accuracy.white : g.analysis.accuracy.black) : null;
                  return (
                    <tr key={g.id} className="border-t border-line">
                      <td className="py-2.5 text-fg">{formatRelativeDay(g.startedAt)}</td>
                      <td className="py-2.5 font-semibold text-ink">{getLevel(g.config.levelId).name}</td>
                      <td className="py-2.5 text-fg">{g.config.mode === "rated" ? "Rated" : "Practice"}</td>
                      <td className="py-2.5 text-fg">{VIS_NAMES[g.config.visibility]}</td>
                      <td className="py-2.5">
                        <span className={cn("font-semibold", r.outcome === "win" ? "text-good" : r.outcome === "loss" ? "text-bad" : "text-ink")}>
                          {r.outcome === "win" ? "Won" : r.outcome === "loss" ? "Lost" : "Draw"}
                        </span>
                      </td>
                      <td className="py-2.5 tabular text-ink">{acc !== null ? `${acc}%` : "None"}</td>
                      <td className="py-2.5 tabular text-fg">{g.peeksUsed}</td>
                      <td className="py-2.5 tabular text-fg">{g.illegalAttempts}</td>
                      <td className="py-2.5 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setReplay(g)} onPointerEnter={preloadReplay} onFocus={preloadReplay}>
                          Replay
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyChart text="No finished games yet.">
            <LinkButton href="/play?new=1" size="sm" variant="primary">
              Play now
            </LinkButton>
          </EmptyChart>
        )}
      </Panel>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset all progress?"
        description="This deletes every game, drill session, puzzle attempt and rating stored in this browser. Export first if you want a backup."
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmReset(false)} data-autofocus>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              void clearProgress();
              setConfirmReset(false);
            }}
          >
            Delete everything
          </Button>
        </div>
      </Modal>

      <Modal
        open={pendingImport !== null}
        onClose={() => setPendingImport(null)}
        title="Import progress"
        description="Merge keeps what you have and adds the file's records. Replace wipes this browser's progress first."
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => setPendingImport(null)}>
            Cancel
          </Button>
          <Button onClick={() => void runImport("replace")}>Replace</Button>
          <Button variant="primary" onClick={() => void runImport("merge")} data-testid="import-merge" data-autofocus>
            Merge
          </Button>
        </div>
      </Modal>

      {replay ? <ReplayModal game={replay} onClose={() => setReplay(null)} /> : null}
    </div>
  );
}
