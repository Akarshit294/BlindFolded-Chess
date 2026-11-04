"use client";
import type { Move, PieceSymbol, Square } from "chess.js";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Board, type BoardHandle, type MoveResult } from "@/components/board/Board";
import { Confetti } from "@/components/fx/Confetti";
import { Button, IconButton } from "@/components/ui/Button";
import { Badge, Kbd } from "@/components/ui/Controls";
import { EyeMorph } from "@/components/ui/EyeMorph";
import { IconFlag, IconFlip, IconHandshake, IconKeyboard, IconUndo } from "@/components/ui/Icons";
import { Modal } from "@/components/ui/Modal";
import { announce } from "@/lib/a11y/announcer";
import { analyzeGame, summarize, type GameAnalysis } from "@/lib/analysis/analyze";
import { moveSound, playSound } from "@/lib/audio/sounds";
import { describePosition, sanToSpeech } from "@/lib/chess/notation";
import { evaluatePosition, getEngine, pickEngineMove } from "@/lib/engine/engine";
import { getLevel } from "@/lib/engine/levels";
import { canWinOnTime, describeResult, detectResult, kingSquare, replay, scoreFor, uciToMove } from "@/lib/game/rules";
import { peeksLeft, remainingMs, useGame } from "@/lib/game/store";
import { useSettings } from "@/lib/settings/store";
import { speak, stopSpeaking } from "@/lib/speech/tts";
import { getRatings, saveGame, setRatings } from "@/lib/storage/db";
import type { GameResult } from "@/lib/storage/types";
import { updateRating } from "@/lib/stats/rating";
import { cn } from "@/lib/utils/cn";
import { useE2E } from "@/lib/utils/e2e";
import { BlindPanel, ThinkingDots } from "./BlindPanel";
import { Clock } from "./Clock";
import { GameOverPanel } from "./GameOverPanel";
import { MoveInput, type MoveInputHandle } from "./MoveInput";
import { MoveList } from "./MoveList";
import { VISIBILITY_MODES } from "./GameSetup";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function useNow(active: boolean, interval = 100): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(id);
  }, [active, interval]);
  return now;
}

export function GameScreen({ onNewSetup }: { onNewSetup: () => void }) {
  const game = useGame((s) => s.game)!;
  const turnStartedAt = useGame((s) => s.turnStartedAt);
  const settings = useSettings();
  const e2e = useE2E();

  const { chess, history } = useMemo(() => replay(game.moves), [game.moves]);
  const fen = chess.fen();
  const turn = chess.turn();
  const player = game.config.playerColor;
  const engineColor = player === "w" ? "b" : "w";
  const level = getLevel(game.config.levelId);
  const visibility = game.config.visibility;
  const rated = game.config.mode === "rated";
  const over = !!game.result;
  const legal = useMemo(() => chess.moves({ verbose: true }), [chess]);
  const lastMove = history[history.length - 1] ?? null;

  const boardRef = useRef<BoardHandle>(null);
  const inputRef = useRef<MoveInputHandle>(null);
  const [engineError, setEngineError] = useState(false);
  // The engine is thinking whenever it is its turn in a live game.
  const thinking = !over && turn === engineColor && !engineError;
  const [peeking, setPeeking] = useState(false);
  const [revealed, setRevealed] = useState(over);
  const [showOver, setShowOver] = useState(over);
  const [confetti, setConfetti] = useState(0);
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  // A refreshed page shows a small "restored" note straight away.
  const [toast, setToast] = useState<{ text: string; tone: "info" | "bad" | "good" } | null>(() =>
    game.moves.length > 0 && !game.result ? { text: "Game restored — carry on.", tone: "info" } : null,
  );
  const [confirmResign, setConfirmResign] = useState(false);
  const [drawPly, setDrawPly] = useState(-99);
  const [helpOpen, setHelpOpen] = useState(false);
  const [orientation, setOrientation] = useState<"white" | "black">(player === "w" ? "white" : "black");
  const finishing = useRef(false);

  const showToast = useCallback((text: string, tone: "info" | "bad" | "good" = "info") => {
    setToast({ text, tone });
    window.setTimeout(() => setToast((t) => (t?.text === text ? null : t)), 2600);
  }, []);

  /* ------------------------------------------------------------------ restore after reload */
  useEffect(() => {
    useGame.getState().resumeClock();
    if (game.moves.length === 0) playSound("start");
    const t = window.setTimeout(() => setToast((cur) => (cur?.text.startsWith("Game restored") ? null : cur)), 2600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id]);

  /* ------------------------------------------------------------------ finishing */
  const finish = useCallback(
    async (result: GameResult) => {
      if (finishing.current || useGame.getState().game?.result) return;
      finishing.current = true;
      getEngine().stop();
      useGame.getState().end(result);
      const res = describeResult(result, player);
      announce(`Game over. ${res.title} ${res.detail}`, "assertive");
      const mate = result.reason === "checkmate";
      window.setTimeout(() => {
        playSound(res.outcome === "win" ? "win" : res.outcome === "loss" ? "lose" : "draw");
        setRevealed(true);
        if (res.outcome === "win") setConfetti((c) => c + 1);
        speak(res.title);
      }, mate ? 900 : 300);
      window.setTimeout(() => setShowOver(true), mate ? 2800 : 1900);

      // Rated: update the local blindfold rating.
      const g = useGame.getState().game!;
      if (g.config.mode === "rated") {
        const ratings = await getRatings();
        const before = ratings.blindfold.rating;
        const after = updateRating(before, level.elo, scoreFor(result, player), ratings.blindfold.played);
        await setRatings({ ...ratings, blindfold: { rating: after, played: ratings.blindfold.played + 1, peak: Math.max(ratings.blindfold.peak, after) } });
        useGame.getState().setRating(before, after);
      }
      await saveGame(useGame.getState().game!);
    },
    [player, level.elo],
  );

  /* Result detection after every move. */
  useEffect(() => {
    if (game.result) return;
    const r = detectResult(chess);
    if (r) void finish(r);
  }, [chess, game.result, finish]);

  /* ------------------------------------------------------------------ committing moves */
  const commitMove = useCallback(
    (move: Move, by: "you" | "engine") => {
      useGame.getState().applyMove(move.lan, move.san);
      playSound(moveSound(move));
      const spoken = sanToSpeech(move.san);
      announce(`${by === "you" ? "You" : level.name} played ${spoken}`);
      if (by === "engine" || settings.announceOwnMoves) void speak(spoken);
      if (visibility !== "full" && visibility !== "blind") boardRef.current?.trail(move.from, move.to);
      if (visibility === "empty") boardRef.current?.flash([move.from, move.to]);
    },
    [level.name, settings.announceOwnMoves, visibility],
  );

  const registerIllegal = useCallback(
    (what: string) => {
      useGame.getState().illegal();
      playSound("illegal");
      announce(`Illegal move: ${what}`, "assertive");
      if (rated) showToast("Illegal move — counted.", "bad");
    },
    [rated, showToast],
  );

  /* ------------------------------------------------------------------ engine turn */
  useEffect(() => {
    if (over || turn !== engineColor) return;
    let cancelled = false;
    const ply = game.moves.length;
    const started = performance.now();
    (async () => {
      try {
        const st = useGame.getState();
        const remaining = st.game ? remainingMs(st.game, st.turnStartedAt, engineColor) : null;
        const budget = e2e.fast ? 40 : remaining !== null ? Math.max(80, remaining / 30) : undefined;
        const res = await pickEngineMove(fen, level.id, { timeBudgetMs: budget });
        if (cancelled || res.cancelled || !res.uci) return;
        const minDelay = e2e.fast ? 0 : 380 + Math.random() * 420;
        const elapsed = performance.now() - started;
        if (elapsed < minDelay) await sleep(minDelay - elapsed);
        if (cancelled || useGame.getState().game?.moves.length !== ply || useGame.getState().game?.result) return;
        const mv = legal.find((m) => m.lan === res.uci) ?? legal.find((m) => m.from === uciToMove(res.uci!).from && m.to === uciToMove(res.uci!).to);
        if (mv) commitMove(mv, "engine");
      } catch {
        if (!cancelled) {
          setEngineError(true);
          showToast("The engine failed to load. Reload the page to retry.", "bad");
        }
      }
    })();
    return () => {
      cancelled = true;
      getEngine().stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id, game.moves.length, over, turn, engineColor]);

  /* ------------------------------------------------------------------ clocks */
  const timed = !!game.clocks;
  const now = useNow(timed && !over, 100);
  const myTime = timed ? remainingMs(game, turnStartedAt, player, now) : null;
  const engineTime = timed ? remainingMs(game, turnStartedAt, engineColor, now) : null;
  useEffect(() => {
    if (!timed || over) return;
    const t = turn === player ? myTime : engineTime;
    if (t !== null && t <= 0) {
      const winner = turn === "w" ? "b" : "w";
      void finish({ winner: canWinOnTime(chess, winner) ? winner : null, reason: "timeout" });
    } else if (t !== null && turn === player && t < 10_000 && Math.floor(t / 1000) !== Math.floor((t + 100) / 1000)) {
      playSound("tick");
    }
  }, [timed, over, turn, player, myTime, engineTime, chess, finish]);

  /* ------------------------------------------------------------------ actions */
  const canAct = !over && turn === player && !thinking;

  const onBoardMove = (from: Square, to: Square, promotion?: PieceSymbol): MoveResult => {
    if (!canAct) return "illegal";
    const candidates = legal.filter((m) => m.from === from && m.to === to);
    if (candidates.length === 0) {
      registerIllegal(`${from} to ${to}`);
      return "illegal";
    }
    if (candidates.some((m) => m.promotion) && !promotion) return "promotion";
    const mv = candidates.find((m) => !m.promotion || m.promotion === promotion) ?? candidates[0]!;
    commitMove(mv, "you");
    return "ok";
  };

  const peek = useCallback(() => {
    if (over || peeking || visibility === "full") return;
    if (!useGame.getState().usePeek()) {
      showToast("No peeks left.", "bad");
      return;
    }
    playSound("peek");
    setPeeking(true);
    announce(`Peek: ${describePosition(fen)}`);
    window.setTimeout(() => setPeeking(false), settings.peekSeconds * 1000);
  }, [over, peeking, visibility, showToast, fen, settings.peekSeconds]);

  const takebackPlies = turn === player ? 2 : 1;
  const canTakeback = !rated && !over && game.moves.length >= takebackPlies && (turn === player || thinking);
  const takeback = () => {
    if (!canTakeback) return;
    getEngine().stop();
    stopSpeaking();
    useGame.getState().takeback(takebackPlies);
    announce("Move taken back");
    showToast("Move taken back.");
  };

  const offerDraw = async () => {
    if (!canAct) return;
    if (game.moves.length - drawPly < 10) {
      showToast("You offered a draw recently. Play on a little.");
      return;
    }
    setDrawPly(game.moves.length);
    showToast(`${level.name} is considering…`);
    const r = await evaluatePosition(fen, { depth: 10, movetime: 400 });
    const cp = r.score.mate !== null ? (r.score.mate > 0 ? 2000 : -2000) : (r.score.cp ?? 0);
    const enginePov = engineColor === "w" ? cp : -cp;
    const accept = enginePov <= -60 || (Math.abs(enginePov) <= 35 && game.moves.length >= 30);
    if (accept) void finish({ winner: null, reason: "agreement" });
    else showToast(`${level.name} declines the draw.`, "bad");
  };

  const resign = () => {
    setConfirmResign(false);
    void finish({ winner: engineColor, reason: "resign" });
  };

  /* ------------------------------------------------------------------ analysis */
  useEffect(() => {
    if (!showOver || analysis || game.moves.length < 2) return;
    const ctrl = new AbortController();
    analyzeGame(game.moves, { signal: ctrl.signal, onProgress: (d, t) => setProgress(d / t), preferServer: !e2e.fast })
      .then(async (a) => {
        setAnalysis(a);
        setProgress(null);
        useGame.getState().setAnalysis(summarize(a));
        await saveGame(useGame.getState().game!);
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === "AbortError") return;
        setAnalysisError("Analysis unavailable right now.");
        setProgress(null);
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOver, game.id]);

  /* ------------------------------------------------------------------ keyboard shortcuts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement | null)?.tagName === "INPUT";
      const key = e.key.toLowerCase();
      if (!typing || e.altKey) {
        if (key === "p" && (e.altKey || !typing)) {
          e.preventDefault();
          peek();
        } else if (key === "f" && !typing) setOrientation((o) => (o === "white" ? "black" : "white"));
        else if (key === "m" && (e.altKey || !typing)) {
          e.preventDefault();
          inputRef.current?.startVoice();
        } else if (key === "/" && !typing) {
          e.preventDefault();
          inputRef.current?.focus();
        } else if (key === "?" && !typing) setHelpOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [peek]);

  /* E2E hook: lets Playwright read the position without parsing the UI. */
  useEffect(() => {
    if (!e2e.enabled) return;
    (window as unknown as { __bf?: unknown }).__bf = { fen, turn, player, moves: game.moves, result: game.result, thinking };
  }, [e2e.enabled, fen, turn, player, game.moves, game.result, thinking]);

  /* ------------------------------------------------------------------ render */
  if (showOver && game.result) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <Confetti fire={confetti} />
        <GameOverPanel
          game={game}
          analysis={analysis}
          progress={progress}
          analysisError={analysisError}
          onRematch={() => {
            finishing.current = false;
            useGame.getState().start(game.config);
            window.scrollTo({ top: 0, behavior: "instant" });
          }}
          onNewGame={() => {
            useGame.getState().clear();
            onNewSetup();
          }}
        />
      </div>
    );
  }

  const reveal = peeking || revealed;
  const boardVisibility = visibility === "blind" ? "full" : visibility;
  const inCheck = chess.inCheck();
  const matedSquare = revealed && game.result?.reason === "checkmate" ? kingSquare(chess, turn) : null;
  const checkSquare = inCheck && (visibility === "full" || reveal) && !matedSquare ? kingSquare(chess, turn) : null;
  const slowFinal = !!lastMove && lastMove.san.includes("#");
  const left = peeksLeft(game);
  const modeMeta = VISIBILITY_MODES.find((m) => m.id === visibility)!;

  const board = (
    <Board
      ref={boardRef}
      fen={fen}
      orientation={orientation}
      lastMove={lastMove ? { from: lastMove.from, to: lastMove.to, flags: lastMove.flags, promotion: lastMove.promotion, captured: lastMove.captured } : null}
      visibility={boardVisibility}
      reveal={reveal}
      interactive={canAct}
      movableColor={player}
      legalMoves={visibility === "full" || reveal ? legal : undefined}
      showLegalHints={!rated && (visibility === "full" || reveal)}
      onMove={onBoardMove}
      checkSquare={checkSquare}
      matedSquare={matedSquare}
      ghostDelayMs={settings.ghostDelay * 1000}
      speed={slowFinal ? "slow" : "normal"}
      ariaLabel={visibility === "full" || reveal ? "Chessboard" : "Hidden chessboard — click a from-square, then a to-square"}
    />
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-6 sm:px-6" data-testid="game-screen">
      <Confetti fire={confetti} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* Board column */}
        <section aria-label="Game" className="mx-auto w-full max-w-[min(100%,calc(100dvh-15rem))] lg:max-w-[min(100%,calc(100dvh-14rem))]">
          <PlayerBar
            name={level.name}
            detail={`Level ${level.id} · ≈${level.elo}`}
            color={engineColor}
            time={engineTime}
            active={!over && turn === engineColor}
            thinking={thinking}
          />
          <div className="relative my-2.5">
            {visibility === "blind" ? (
              <AnimatePresence mode="popLayout" initial={false}>
                {reveal ? (
                  <motion.div
                    key="board"
                    initial={{ opacity: 0, y: 40, scale: 0.94, rotateX: 18 }}
                    animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
                    exit={{ opacity: 0, y: 30, scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 260, damping: 26 }}
                    style={{ transformPerspective: 1200 }}
                  >
                    {board}
                  </motion.div>
                ) : (
                  <motion.div key="blind" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                    <BlindPanel
                      lastSan={lastMove?.san ?? null}
                      lastBy={lastMove ? (lastMove.color === player ? "you" : "engine") : null}
                      ply={history.length}
                      thinking={thinking}
                      inCheck={inCheck && turn === player}
                      engineName={level.name}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            ) : (
              board
            )}
            <AnimatePresence>
              {peeking ? (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="pointer-events-none absolute left-1/2 top-3 z-50 -translate-x-1/2 rounded-full bg-night-950/80 px-3 py-1 text-xs font-semibold text-ember-200 ring-1 ring-ember-400/40 backdrop-blur"
                >
                  Peeking…
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
          <PlayerBar
            name="You"
            detail={rated ? "Rated game" : "Practice"}
            color={player}
            time={myTime}
            active={!over && turn === player}
          />
        </section>

        {/* Side panel */}
        <aside className="flex min-w-0 flex-col gap-4" aria-label="Moves and controls">
          <div className="surface rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-moon-300">
                  <EyeMorph closed={visibility !== "full" && !reveal} size={22} />
                </span>
                <span className="text-sm font-semibold text-ivory-100">{modeMeta.name}</span>
                <Badge tone={rated ? "ember" : "moon"}>{rated ? "Rated" : "Practice"}</Badge>
              </div>
              <IconButton label="Keyboard shortcuts" onClick={() => setHelpOpen(true)}>
                <IconKeyboard size={18} />
              </IconButton>
            </div>
            <StatusLine over={over} myTurn={turn === player} thinking={thinking} inCheck={inCheck} engineName={level.name} />
            <div className="mt-3">
              <MoveInput
                ref={inputRef}
                chess={chess}
                disabled={!canAct}
                hints={rated ? "off" : settings.moveHints}
                onMove={(m) => commitMove(m, "you")}
                onIllegal={(raw) => registerIllegal(raw)}
              />
            </div>
            <AnimatePresence>
              {toast ? (
                <motion.div
                  key={toast.text}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className={cn("overflow-hidden text-sm", toast.tone === "bad" ? "text-coral-300" : toast.tone === "good" ? "text-jade-300" : "text-moon-200")}
                  role="status"
                >
                  <div className="pt-2">{toast.text}</div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            <Button
              variant="moon"
              onClick={peek}
              disabled={over || visibility === "full" || left <= 0 || peeking}
              data-testid="peek"
              icon={<EyeMorph closed={!peeking} size={18} />}
              title="Peek (P)"
            >
              Peek {Number.isFinite(left) ? <span className="font-mono text-xs opacity-80">{left}</span> : null}
            </Button>
            <Button onClick={takeback} disabled={!canTakeback} icon={<IconUndo size={17} />} title={rated ? "No takebacks in rated games" : "Take back"} data-testid="takeback">
              Undo
            </Button>
            <Button onClick={() => void offerDraw()} disabled={!canAct || game.moves.length < 2} icon={<IconHandshake size={17} />} data-testid="offer-draw">
              Draw
            </Button>
            <Button
              variant="danger"
              onClick={() => (settings.confirmResign ? setConfirmResign(true) : resign())}
              disabled={over}
              icon={<IconFlag size={17} />}
              data-testid="resign"
            >
              Resign
            </Button>
          </div>

          <MoveList sans={game.sans} mode={game.config.moveList} />

          <div className="flex items-center justify-between gap-2 px-1 text-xs text-ivory-500">
            <span data-testid="illegal-count">
              Illegal attempts: <span className="font-mono text-ivory-300">{game.illegalAttempts}</span>
            </span>
            <span>
              Peeks used: <span className="font-mono text-ivory-300">{game.peeksUsed}</span>
            </span>
            <IconButton label="Flip board (F)" onClick={() => setOrientation((o) => (o === "white" ? "black" : "white"))}>
              <IconFlip size={17} />
            </IconButton>
          </div>
        </aside>
      </div>

      <Modal open={confirmResign} onClose={() => setConfirmResign(false)} title="Resign this game?">
        <p className="text-sm text-ivory-300">{rated ? "This counts as a loss for your blindfold rating." : "No worries — it's practice."}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmResign(false)} data-autofocus>
            Keep playing
          </Button>
          <Button variant="danger" onClick={resign} data-testid="confirm-resign">
            Resign
          </Button>
        </div>
      </Modal>

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Shortcuts & input">
        <ul className="space-y-2 text-sm text-ivory-300">
          <li className="flex justify-between gap-4"><span>Peek at the board</span><span><Kbd>P</Kbd> / <Kbd>Alt</Kbd>+<Kbd>P</Kbd></span></li>
          <li className="flex justify-between gap-4"><span>Speak a move</span><span><Kbd>M</Kbd> / <Kbd>Alt</Kbd>+<Kbd>M</Kbd></span></li>
          <li className="flex justify-between gap-4"><span>Focus the move box</span><Kbd>/</Kbd></li>
          <li className="flex justify-between gap-4"><span>Flip the board</span><Kbd>F</Kbd></li>
          <li className="flex justify-between gap-4"><span>Move a cursor on the board</span><span><Kbd>←</Kbd><Kbd>→</Kbd><Kbd>↑</Kbd><Kbd>↓</Kbd> + <Kbd>Enter</Kbd></span></li>
        </ul>
        <p className="mt-4 text-sm text-ivory-400">
          Moves can be typed as SAN (<code className="font-mono text-ivory-200">Nf3</code>, <code className="font-mono text-ivory-200">exd5</code>, <code className="font-mono text-ivory-200">O-O</code>), UCI
          (<code className="font-mono text-ivory-200">g1f3</code>) or words (<code className="font-mono text-ivory-200">knight to f3</code>, <code className="font-mono text-ivory-200">castle long</code>).
        </p>
      </Modal>
    </div>
  );
}

function StatusLine({ over, myTurn, thinking, inCheck, engineName }: { over: boolean; myTurn: boolean; thinking: boolean; inCheck: boolean; engineName: string }) {
  let content: React.ReactNode;
  let key: string;
  if (over) {
    key = "over";
    content = <span className="text-ivory-300">Game over</span>;
  } else if (thinking) {
    key = "thinking";
    content = (
      <span className="flex items-center gap-2 text-moon-200">
        <ThinkingDots /> {engineName} is thinking
      </span>
    );
  } else if (myTurn) {
    key = inCheck ? "check" : "turn";
    content = inCheck ? <span className="font-semibold text-coral-300">Check! Your move.</span> : <span className="text-ember-200">Your move</span>;
  } else {
    key = "wait";
    content = <span className="text-ivory-400">Waiting…</span>;
  }
  return (
    <div className="h-6 text-sm" data-testid="status-line">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={key} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 6 }} transition={{ duration: 0.18 }}>
          {content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function PlayerBar({
  name,
  detail,
  color,
  time,
  active,
  thinking,
}: {
  name: string;
  detail: string;
  color: "w" | "b";
  time: number | null;
  active: boolean;
  thinking?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={cn(
            "h-7 w-7 shrink-0 rounded-lg ring-1 ring-inset",
            color === "w" ? "bg-gradient-to-br from-ivory-50 to-ivory-300 ring-ivory-50/40" : "bg-gradient-to-br from-night-500 to-night-800 ring-ivory-100/15",
          )}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2 truncate text-sm font-semibold text-ivory-50">
            {name}
            {thinking ? (
              <span className="text-moon-300">
                <ThinkingDots />
              </span>
            ) : null}
          </div>
          <div className="truncate text-xs text-ivory-500">{detail}</div>
        </div>
      </div>
      {time !== null ? <Clock ms={time} active={active} label={name} testId={name === "You" ? "clock-you" : "clock-engine"} /> : null}
    </div>
  );
}
