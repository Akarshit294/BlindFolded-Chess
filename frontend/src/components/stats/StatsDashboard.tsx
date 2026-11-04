"use client";
import { motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DRILLS } from "@/components/drills/catalog";
import { ReplayViewer } from "@/components/game/ReplayViewer";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Controls";
import { IconDownload, IconTrash, IconUpload } from "@/components/ui/Icons";
import { Modal } from "@/components/ui/Modal";
import { analyzeGame, type GameAnalysis } from "@/lib/analysis/analyze";
import { getLevel } from "@/lib/engine/levels";
import { describeResult } from "@/lib/game/rules";
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
import { formatDuration, formatRelativeDay } from "@/lib/utils/format";
import { BarList, EmptyChart, Heatmap, LineChart, SERIES_COLORS, Sparkline } from "./charts";

type Data = { games: GameRecord[]; sessions: DrillSession[]; puzzles: PuzzleAttempt[]; ratings: Ratings };

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

function StatTile({ label, value, sub, delta, trend }: { label: string; value: ReactNode; sub?: ReactNode; delta?: number | null; trend?: ReactNode }) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } } }}
      className="surface flex flex-col justify-between rounded-2xl p-4"
    >
      <div className="text-xs font-medium text-ivory-400">{label}</div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div>
          <div className="text-[28px] font-semibold leading-none tracking-tight text-ivory-50">{value}</div>
          {sub || (delta !== undefined && delta !== null) ? (
            <div className="mt-1.5 flex items-center gap-2 text-xs text-ivory-500">
              {delta !== undefined && delta !== null && delta !== 0 ? (
                <span className={cn("font-semibold", delta > 0 ? "text-jade-300" : "text-coral-300")}>
                  {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}
                </span>
              ) : null}
              {sub}
            </div>
          ) : null}
        </div>
        {trend}
      </div>
    </motion.div>
  );
}

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
      setImportMsg(`Imported ${r.games} games, ${r.sessions} drill sessions and ${r.puzzles} puzzle attempts.`);
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
      <div className="mx-auto max-w-6xl space-y-4 px-4 pt-8 sm:px-6" aria-busy="true">
        <div className="skeleton h-12 w-64" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton h-28" />
          ))}
        </div>
        <div className="skeleton h-72" />
      </div>
    );
  }

  const { totals, ptotals, streak, ratings } = derived;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl font-semibold text-ivory-50 sm:text-5xl">Your progress</h1>
          <p className="mt-2 text-ivory-300">Stored only in this browser. Export it to keep a backup or move devices.</p>
        </motion.div>
        <div className="flex flex-wrap gap-2">
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
        </div>
      </div>
      {importMsg ? (
        <p className="mt-3 text-sm text-moon-200" role="status" data-testid="import-message">
          {importMsg}
        </p>
      ) : null}

      {derived.empty ? (
        <Card className="mt-8 p-8 text-center">
          <h2 className="text-2xl font-semibold text-ivory-50">Nothing here yet</h2>
          <p className="mx-auto mt-2 max-w-md text-ivory-400">Play a blindfold game, run a drill or solve a puzzle — your ratings, streaks and charts will grow from there.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <LinkButton href="/play" variant="primary">
              Play a game
            </LinkButton>
            <LinkButton href="/train">Start a drill</LinkButton>
            <LinkButton href="/puzzles">Solve a puzzle</LinkButton>
          </div>
        </Card>
      ) : null}

      {/* KPI row */}
      <motion.div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}>
        <StatTile label="Blindfold rating" value={<AnimatedNumber value={ratings.blindfold.rating} />} delta={derived.bDelta} sub={<>peak {ratings.blindfold.peak}</>} />
        <StatTile label="Puzzle rating" value={<AnimatedNumber value={ratings.puzzles.rating} />} delta={derived.pDelta} sub={<>peak {ratings.puzzles.peak}</>} />
        <StatTile label="Current streak" value={<><AnimatedNumber value={streak.current} /> <span className="text-base font-medium text-ivory-400">{streak.current === 1 ? "day" : "days"}</span></>} sub={<>best {streak.best}</>} />
        <StatTile label="Training time" value={formatDuration(derived.time)} sub={<>{data.sessions.length} drill sessions</>} />
        <StatTile label="Games" value={<AnimatedNumber value={totals.played} />} sub={<>{totals.wins}W · {totals.draws}D · {totals.losses}L</>} />
        <StatTile
          label="Puzzles solved"
          value={<><AnimatedNumber value={ptotals.attempts ? Math.round((ptotals.solved / ptotals.attempts) * 100) : 0} />%</>}
          sub={<>{ptotals.solved} of {ptotals.attempts}</>}
        />
      </motion.div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-5">
          <h2 className="mb-3 text-lg font-semibold text-ivory-50">Ratings over time</h2>
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
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-lg font-semibold text-ivory-50">Activity</h2>
          <Heatmap days={derived.grid} title="Daily activity, last 16 weeks" />
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-night-850/70 p-3 ring-1 ring-inset ring-ivory-100/[0.05]">
              <div className="text-xs text-ivory-500">Current streak</div>
              <div className="mt-0.5 font-semibold text-ivory-50">{streak.current} days</div>
            </div>
            <div className="rounded-xl bg-night-850/70 p-3 ring-1 ring-inset ring-ivory-100/[0.05]">
              <div className="text-xs text-ivory-500">Longest streak</div>
              <div className="mt-0.5 font-semibold text-ivory-50">{streak.best} days</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-5">
          <h2 className="mb-1 text-lg font-semibold text-ivory-50">Drills</h2>
          <p className="mb-3 text-sm text-ivory-400">Rating per drill, with accuracy over your last sessions.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm" data-testid="drill-table">
              <caption className="sr-only">Drill ratings and accuracy</caption>
              <thead className="text-xs text-ivory-500">
                <tr>
                  <th scope="col" className="py-2 font-medium">Drill</th>
                  <th scope="col" className="py-2 text-right font-medium">Rating</th>
                  <th scope="col" className="py-2 text-right font-medium">Sessions</th>
                  <th scope="col" className="py-2 text-right font-medium">Best</th>
                  <th scope="col" className="py-2 pl-4 font-medium">Accuracy trend</th>
                </tr>
              </thead>
              <tbody>
                {DRILLS.map((d) => {
                  const list = data.sessions.filter((s) => s.drill === d.id);
                  const r = ratings.drills[d.id];
                  const best = list.length ? Math.max(...list.map((s) => Math.round(s.accuracy * 100))) : null;
                  const series = drillAccuracySeries(data.sessions, d.id);
                  return (
                    <tr key={d.id} className="border-t border-ivory-100/[0.05]">
                      <td className="py-2.5">
                        <Link href={`/train/${d.id}`} className="font-medium text-ivory-100 hover:text-ember-200">
                          {d.title}
                        </Link>
                      </td>
                      <td className="py-2.5 text-right tabular text-ivory-100">{r ? r.rating : "—"}</td>
                      <td className="py-2.5 text-right tabular text-ivory-300">{list.length || "—"}</td>
                      <td className="py-2.5 text-right tabular text-ivory-300">{best !== null ? `${best}%` : "—"}</td>
                      <td className="py-2.5 pl-4">
                        <Sparkline points={series} label={`${d.title} accuracy over the last ${Math.min(12, series.length)} sessions`} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="mb-1 text-lg font-semibold text-ivory-50">Puzzles by goal</h2>
          <p className="mb-4 text-sm text-ivory-400">Share solved, by puzzle type.</p>
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
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <h2 className="mb-1 text-lg font-semibold text-ivory-50">Game accuracy</h2>
        <p className="mb-3 text-sm text-ivory-400">Engine-measured accuracy of your moves in analysed games.</p>
        {derived.accSeries.length ? (
          <LineChart title="Game accuracy over time" yDomain={[0, 100]} yFormat={(v) => `${Math.round(v)}%`} series={[{ id: "acc", label: "Accuracy", color: SERIES_COLORS[0], points: derived.accSeries }]} height={180} />
        ) : (
          <EmptyChart text="Finish a game to see its accuracy here." />
        )}
      </Card>

      <Card className="mt-6 p-5">
        <h2 className="mb-3 text-lg font-semibold text-ivory-50">Recent games</h2>
        {derived.recent.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm" data-testid="games-table">
              <caption className="sr-only">Recent games</caption>
              <thead className="text-xs text-ivory-500">
                <tr>
                  {["When", "Opponent", "Mode", "Visibility", "Result", "Accuracy", "Peeks", "Illegal", ""].map((h) => (
                    <th key={h} scope="col" className="py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {derived.recent.map((g) => {
                  const r = describeResult(g.result!, g.config.playerColor);
                  const acc = g.analysis ? (g.config.playerColor === "w" ? g.analysis.accuracy.white : g.analysis.accuracy.black) : null;
                  return (
                    <tr key={g.id} className="border-t border-ivory-100/[0.05]">
                      <td className="py-2.5 text-ivory-300">{formatRelativeDay(g.startedAt)}</td>
                      <td className="py-2.5 text-ivory-100">{getLevel(g.config.levelId).name}</td>
                      <td className="py-2.5 text-ivory-300">{g.config.mode === "rated" ? "Rated" : "Practice"}</td>
                      <td className="py-2.5 text-ivory-300">{VIS_NAMES[g.config.visibility]}</td>
                      <td className="py-2.5">
                        <span className={cn("font-medium", r.outcome === "win" ? "text-jade-300" : r.outcome === "loss" ? "text-coral-300" : "text-moon-200")}>{r.outcome === "win" ? "Won" : r.outcome === "loss" ? "Lost" : "Draw"}</span>
                      </td>
                      <td className="py-2.5 tabular text-ivory-200">{acc !== null ? `${acc}%` : "—"}</td>
                      <td className="py-2.5 tabular text-ivory-300">{g.peeksUsed}</td>
                      <td className="py-2.5 tabular text-ivory-300">{g.illegalAttempts}</td>
                      <td className="py-2.5 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setReplay(g)}>
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
            <LinkButton href="/play" size="sm" variant="primary">
              Play now
            </LinkButton>
          </EmptyChart>
        )}
      </Card>

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset all progress?">
        <p className="text-sm text-ivory-300">This deletes every game, drill session, puzzle attempt and rating stored in this browser. Export first if you want a backup.</p>
        <div className="mt-5 flex justify-end gap-2">
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

      <Modal open={pendingImport !== null} onClose={() => setPendingImport(null)} title="Import progress">
        <p className="text-sm text-ivory-300">Merge keeps what you have and adds the file&apos;s records. Replace wipes this browser&apos;s progress first.</p>
        <div className="mt-5 flex justify-end gap-2">
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

function ReplayModal({ game, onClose }: { game: GameRecord; onClose: () => void }) {
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(null);
  const [progress, setProgress] = useState(0);
  const run = useCallback(() => {
    const ctrl = new AbortController();
    analyzeGame(game.moves, { signal: ctrl.signal, onProgress: (d, t) => setProgress(d / t) })
      .then(setAnalysis)
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [game.moves]);
  useEffect(() => (game.moves.length >= 2 ? run() : undefined), [run, game.moves.length]);
  return (
    <Modal open onClose={onClose} title={`${describeResult(game.result!, game.config.playerColor).title} vs ${getLevel(game.config.levelId).name}`} className="max-w-5xl">
      {!analysis && game.moves.length >= 2 ? (
        <div className="mb-3 flex items-center gap-3 text-xs text-ivory-400">
          Analysing…
          <div className="h-1.5 w-48 overflow-hidden rounded-full bg-night-700">
            <motion.div className="h-full origin-left bg-moon-400" animate={{ scaleX: progress }} />
          </div>
        </div>
      ) : null}
      <div className="max-h-[75vh] overflow-y-auto">
        <ReplayViewer moves={game.moves} analysis={analysis} orientation={game.config.playerColor === "w" ? "white" : "black"} />
      </div>
    </Modal>
  );
}
