"use client";
import type { Move, PieceSymbol, Square } from "chess.js";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, ViewTransition } from "react";
import { Board, type BoardHandle, type MoveResult } from "@/components/board/Board";
import { EvalBar } from "@/components/board/EvalBar";
import { Confetti } from "@/components/fx/Confetti";
import { Button, IconButton } from "@/components/ui/Button";
import { Badge, Kbd, Panel } from "@/components/ui/Controls";
import { EyeMorph } from "@/components/ui/EyeMorph";
import { IconFlag, IconFlip, IconHandshake, IconKeyboard, IconUndo } from "@/components/ui/Icons";
import { Modal } from "@/components/ui/Modal";
import { Portal } from "@/components/ui/Portal";
import { announce } from "@/lib/a11y/announcer";
import { analyzeGame, summarize, type GameAnalysis } from "@/lib/analysis/analyze";
import { moveSound, playSound } from "@/lib/audio/sounds";
import { describePosition, sanToSpeech } from "@/lib/chess/notation";
import { evaluatePosition, getEngine, pickEngineMove } from "@/lib/engine/engine";
import { getLevel } from "@/lib/engine/levels";
import { modeName } from "@/lib/game/modes";
import { canWinOnTime, describeResult, detectResult, kingSquare, replay, scoreFor, uciToMove } from "@/lib/game/rules";
import { peeksLeft, remainingMs, useGame, type Setup } from "@/lib/game/store";
import { useSettings } from "@/lib/settings/store";
import { speak, stopSpeaking } from "@/lib/speech/tts";
import { getRatings, saveGame, setRatings } from "@/lib/storage/db";
import type { GameResult } from "@/lib/storage/types";
import { updateRating } from "@/lib/stats/rating";
import { toast } from "@/lib/ui/toast";
import { useUi } from "@/lib/ui/store";
import { cn } from "@/lib/utils/cn";
import { useE2E } from "@/lib/utils/e2e";
import { useKeyboardInset, useMediaQuery } from "@/lib/utils/hooks";
import { BlindStage } from "./BlindStage";
import { PlayerBar, StatusLine } from "./bits";
import { MoveInput, type MoveInputHandle } from "./MoveInput";
import { MoveList } from "./MoveList";
import { bestArrow, ReplayControls, useReplay } from "./replay";
import { ResultPanel, ReviewPanel } from "./ResultPanel";
import { ModeGlyph, SetupControls } from "./SetupControls";

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

export function GameScreen() {
  const game = useGame((s) => s.game)!;
  const turnStartedAt = useGame((s) => s.turnStartedAt);
  const setup = useGame((s) => s.setup);
  const settings = useSettings();
  const e2e = useE2E();
  const phone = useMediaQuery("(max-width: 1023px)");

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
  // Before your own first move the setup can still change; the game simply restarts with it.
  const preGame = !over && game.moves.length - (player === "w" ? 0 : 1) <= 0;

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
  const [confirmResign, setConfirmResign] = useState(false);
  const [drawPly, setDrawPly] = useState(-99);
  const [helpOpen, setHelpOpen] = useState(false);
  const [orientation, setOrientation] = useState<"white" | "black">(player === "w" ? "white" : "black");
  const finishing = useRef(false);
  const moreOpen = useUi((s) => s.setupMoreOpen);

  // The review replays on this same board once the game is over.
  const review = showOver && !!game.result;
  const r = useReplay(game.moves, analysis, { keyboard: review });
  // The review opens on the final position.
  const { go: replayGo, total: replayTotal } = r;
  useEffect(() => {
    if (review) replayGo(replayTotal, false);
  }, [review, replayGo, replayTotal]);

  /* ------------------------------------------------------------------ shell: dock and keyboard */
  useEffect(() => {
    useUi.getState().setImmersive(!over);
    return () => useUi.getState().setImmersive(false);
  }, [over]);
  useKeyboardInset(phone && !over);

  /* ------------------------------------------------------------------ restore after reload */
  useEffect(() => {
    // Leaving (reload, closing the tab, another page) banks the time spent on this move and
    // stops the clock; coming back restarts it.
    const pause = () => useGame.getState().pauseClock();
    const resume = () => useGame.getState().resumeClock();
    // Back from the back/forward cache: restart a clock that pagehide stopped (only then).
    const onShow = () => {
      if (useGame.getState().turnStartedAt === null) resume();
    };
    resume();
    window.addEventListener("pagehide", pause);
    window.addEventListener("pageshow", onShow);
    inputRef.current?.focusSoft();
    if (game.moves.length === 0) playSound("start");
    // A refreshed page says that the game came back.
    if (game.moves.length > 0 && !game.result) toast("Game restored. Carry on.");
    return () => {
      window.removeEventListener("pagehide", pause);
      window.removeEventListener("pageshow", onShow);
      pause();
    };
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
      window.setTimeout(() => setShowOver(true), mate ? 2600 : 1600);

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
    const res = detectResult(chess);
    if (res) void finish(res);
  }, [chess, game.result, finish]);

  /* ------------------------------------------------------------------ committing moves */
  const commitMove = useCallback(
    (move: Move, by: "you" | "engine"): boolean => {
      // The store re-checks legality against the real position and refuses stale moves.
      if (!useGame.getState().applyMove(move.lan)) return false;
      playSound(moveSound(move));
      const spoken = sanToSpeech(move.san);
      announce(`${by === "you" ? "You" : level.name} played ${spoken}`);
      if (by === "engine" || settings.announceOwnMoves) void speak(spoken);
      if (visibility !== "full" && visibility !== "blind") boardRef.current?.trail(move.from, move.to);
      if (visibility === "empty") boardRef.current?.flash([move.from, move.to]);
      return true;
    },
    [level.name, settings.announceOwnMoves, visibility],
  );

  const registerIllegal = useCallback(
    (what: string) => {
      useGame.getState().illegal();
      playSound("illegal");
      announce(`Illegal move: ${what}`, "assertive");
      if (rated) toast("Illegal move, counted.", { tone: "bad" });
    },
    [rated],
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
        const res = await pickEngineMove(fen, level.id, { timeBudgetMs: budget, moves: game.moves });
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
          toast("The engine failed to load. Reload the page to retry.", { tone: "bad", duration: 6000 });
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
    return commitMove(mv, "you") ? "ok" : "illegal";
  };

  /** Typed or spoken moves: only on your turn, and only if still legal in this position. */
  const onTypedMove = (m: Move) => {
    if (!canAct) return;
    const mv = legal.find((x) => x.lan === m.lan);
    if (mv) commitMove(mv, "you");
  };

  const peek = useCallback(() => {
    if (over || peeking || visibility === "full") return;
    if (!useGame.getState().usePeek()) {
      toast("No peeks left.", { tone: "bad" });
      return;
    }
    playSound("peek");
    setPeeking(true);
    announce(`Peek: ${describePosition(fen)}`);
    window.setTimeout(() => setPeeking(false), settings.peekSeconds * 1000);
  }, [over, peeking, visibility, fen, settings.peekSeconds]);

  const takebackPlies = turn === player ? 2 : 1;
  const canTakeback = !rated && !over && game.moves.length >= takebackPlies && (turn === player || thinking);
  const takeback = () => {
    if (!canTakeback) return;
    getEngine().stop();
    stopSpeaking();
    useGame.getState().takeback(takebackPlies);
    toast("Move taken back.");
  };

  const offerDraw = async () => {
    if (!canAct) return;
    if (game.moves.length - drawPly < 10) {
      toast("You offered a draw recently. Play on a little.");
      return;
    }
    setDrawPly(game.moves.length);
    toast(`${level.name} is considering…`);
    const asked = { id: game.id, ply: game.moves.length };
    const res = await evaluatePosition(fen, { depth: 10, movetime: 400 });
    // The offer lapses if the search was cut short or the position changed meanwhile (a move,
    // an undo, a new game): a decision about an old position must not end this one.
    const current = useGame.getState().game;
    if (res.cancelled || !current || current.id !== asked.id || current.moves.length !== asked.ply || current.result) return;
    const cp = res.score.mate !== null ? (res.score.mate > 0 ? 2000 : -2000) : (res.score.cp ?? 0);
    const enginePov = engineColor === "w" ? cp : -cp;
    const accept = enginePov <= -60 || (Math.abs(enginePov) <= 35 && game.moves.length >= 30);
    if (accept) void finish({ winner: null, reason: "agreement" });
    else toast(`${level.name} declines the draw.`, { tone: "bad" });
  };

  const resign = () => {
    setConfirmResign(false);
    void finish({ winner: engineColor, reason: "resign" });
  };

  /** Changing the setup before your first move restarts the waiting game with it (and remembers it). */
  const changeSetup = (patch: Partial<Setup>) => {
    getEngine().stop();
    useGame.getState().startFromSetup(patch);
  };

  /* ------------------------------------------------------------------ analysis */
  useEffect(() => {
    if (!showOver || analysis || game.moves.length < 2) return;
    const ctrl = new AbortController();
    const gameId = game.id;
    analyzeGame(game.moves, { signal: ctrl.signal, onProgress: (d, t) => setProgress(d / t), preferServer: !e2e.fast })
      .then(async (a) => {
        // Never write one game's analysis into another (e.g. after Play again).
        if (ctrl.signal.aborted || useGame.getState().game?.id !== gameId) return;
        setAnalysis(a);
        setProgress(null);
        useGame.getState().setAnalysis(summarize(a));
        await saveGame(useGame.getState().game!);
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === "AbortError") return;
        setAnalysisError("Analysis is not available right now.");
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
  const reveal = peeking || revealed;
  const boardVisibility = visibility === "blind" ? "full" : visibility;
  const inCheck = chess.inCheck();
  const matedSquare = revealed && game.result?.reason === "checkmate" ? kingSquare(chess, turn) : null;
  const checkSquare = inCheck && (visibility === "full" || reveal) && !matedSquare ? kingSquare(chess, turn) : null;
  const slowFinal = !!lastMove && lastMove.san.includes("#");
  const left = peeksLeft(game);

  const playRematch = () => {
    finishing.current = false;
    useGame.getState().startFromSetup();
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const changeSetupAfter = () => {
    finishing.current = false;
    useUi.getState().setSetupMoreOpen(false);
    useGame.getState().startFromSetup();
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const board = review ? (
    <Board
      fen={r.fen}
      orientation={orientation}
      lastMove={r.last ? { from: r.last.from, to: r.last.to, flags: r.last.flags, promotion: r.last.promotion, captured: r.last.captured } : null}
      interactive={false}
      arrows={bestArrow(r.pa)}
      matedSquare={r.ply === r.total && game.result?.reason === "checkmate" ? kingSquare(chess, turn) : null}
      ariaLabel={`Replay position after ply ${r.ply}`}
    />
  ) : (
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
      ariaLabel={visibility === "full" || reveal ? "Chessboard" : "Hidden chessboard: click a from-square, then a to-square"}
    />
  );

  const actions = (
    <div className="grid grid-cols-4 gap-2" data-testid="game-actions">
      <Button
        variant="primary"
        onClick={peek}
        disabled={over || visibility === "full" || left <= 0 || peeking}
        data-testid="peek"
        icon={<EyeMorph closed={!peeking} size={18} />}
        title="Peek (P)"
        className="px-3"
      >
        Peek{Number.isFinite(left) ? <span className="tabular opacity-70">{left}</span> : null}
      </Button>
      <Button onClick={takeback} disabled={!canTakeback} icon={<IconUndo size={17} />} title={rated ? "No takebacks in rated games" : "Take back"} data-testid="takeback" className="px-3">
        Undo
      </Button>
      <Button onClick={() => void offerDraw()} disabled={!canAct || game.moves.length < 2} icon={<IconHandshake size={17} />} data-testid="offer-draw" className="px-3">
        Draw
      </Button>
      <Button
        variant="danger"
        onClick={() => (settings.confirmResign ? setConfirmResign(true) : resign())}
        disabled={over}
        icon={<IconFlag size={17} />}
        data-testid="resign"
        className="px-3"
      >
        Resign
      </Button>
    </div>
  );

  const input = (
    <MoveInput
      ref={inputRef}
      chess={chess}
      disabled={!canAct}
      hints={rated ? "off" : settings.moveHints}
      onMove={onTypedMove}
      onIllegal={(raw) => registerIllegal(raw)}
      className={phone ? "flex-col-reverse" : undefined}
    />
  );

  return (
    <div className={cn("px-3 pt-2 sm:px-6 lg:px-10", over ? "pb-10" : "pb-48 lg:pb-10")} data-testid="game-screen">
      <h1 className="sr-only">Play blindfold chess</h1>
      <Confetti fire={confetti} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,1fr)_25rem]">
        {/* Board column */}
        <section aria-label="Board" className="mx-auto w-full max-w-[min(100%,calc(100dvh-14rem))] lg:max-w-[min(100%,calc(100dvh-13rem))]">
          <PlayerBar
            name={level.name}
            detail={`Level ${level.id}, about ${level.elo}`}
            color={engineColor}
            time={engineTime}
            active={!over && turn === engineColor}
            thinking={thinking}
            clockId="clock-engine"
          />
          <div className="relative my-3 flex gap-3">
            {review && analysis ? <EvalBar win={r.win} label={r.label} orientation={orientation} /> : null}
            <ViewTransition name="hero-board" share="board-morph" default="none">
              <div className="relative min-w-0 flex-1">
                {visibility === "blind" && !review ? (
                  <AnimatePresence mode="popLayout" initial={false}>
                    {reveal ? (
                      <motion.div
                        key="board"
                        initial={{ opacity: 0, y: 30, scale: 0.95, filter: "blur(8px)" }}
                        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: 20, scale: 0.97, filter: "blur(6px)" }}
                        transition={{ type: "spring", stiffness: 260, damping: 28 }}
                      >
                        {board}
                      </motion.div>
                    ) : (
                      <motion.div key="blind" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                        <BlindStage
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
                  <motion.div
                    animate={peeking ? { scale: 1.012, y: -6 } : { scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 24 }}
                    className={cn("rounded-[0.875rem] transition-shadow duration-500", peeking && "shadow-[0_0_0_3px_var(--studio-hi),0_0_0_5px_var(--ink),0_40px_80px_-30px_rgb(0_0_0/0.45)]")}
                  >
                    {board}
                  </motion.div>
                )}
                <AnimatePresence>
                  {peeking ? (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="pill-primary pointer-events-none absolute left-1/2 top-0 z-50 -translate-x-1/2 -translate-y-1/2 rounded-full px-4 py-1 text-small font-semibold"
                    >
                      Peeking…
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </ViewTransition>
          </div>
          <PlayerBar name="You" detail={rated ? "Rated game" : "Practice game"} color={player} time={myTime} active={!over && turn === player} clockId="clock-you" />
          {review ? <ReplayControls r={r} className="mx-auto mt-4 max-w-xs" /> : null}
        </section>

        {/* Side panel */}
        <aside aria-label="Game panel" className="flex min-w-0 flex-col gap-4">
          {review ? (
            <>
              <ResultPanel game={game} analysis={analysis} analysisError={analysisError} onRematch={playRematch} onNewSetup={changeSetupAfter} />
              <ReviewPanel game={game} analysis={analysis} progress={progress} analysisError={analysisError} r={r} />
            </>
          ) : (
            <>
              <Panel className="p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <ModeGlyph mode={visibility} size={28} />
                    <span className="truncate font-semibold text-ink">{modeName(visibility)}</span>
                    <Badge tone={rated ? "ink" : "neutral"}>{rated ? "Rated" : "Practice"}</Badge>
                  </div>
                  <IconButton label="Keyboard shortcuts" onClick={() => setHelpOpen(true)} size="sm">
                    <IconKeyboard size={18} />
                  </IconButton>
                </div>
                <StatusLine over={over} myTurn={turn === player} thinking={thinking} inCheck={inCheck} engineName={level.name} />
                {phone ? (
                  <Portal>
                    {/* A labelled region: portalled to the body, it still sits in a landmark. */}
                    <section
                      aria-label="Your move"
                      className={cn(
                        "glass-float fixed inset-x-2 z-50 rounded-[1.5rem] p-2 transition-[bottom] duration-150",
                        "bottom-[calc(max(0.5rem,env(safe-area-inset-bottom))+var(--kb))]",
                        over && "hidden",
                      )}
                      data-testid="move-bar"
                    >
                      <div className="mb-2 [[data-kb=open]_&]:hidden">{actions}</div>
                      {input}
                    </section>
                  </Portal>
                ) : (
                  <div className="mt-3 flex flex-col gap-3">
                    {input}
                    {actions}
                  </div>
                )}
              </Panel>

              {preGame ? (
                <Panel className="p-4 sm:p-5" data-testid="quick-setup">
                  <h2 className="display text-[1.5rem] leading-none">
                    <span className="thin">Ready</span> when you are
                  </h2>
                  <p className="mt-2 text-small text-muted">Make your first move to begin. Change anything below first if you like: it is remembered.</p>
                  <div className="mt-5">
                    <SetupControls setup={setup} onChange={changeSetup} compact moreOpen={moreOpen} onMoreOpenChange={(v) => useUi.getState().setSetupMoreOpen(v)} />
                  </div>
                </Panel>
              ) : (
                <MoveList sans={game.sans} mode={game.config.moveList} />
              )}

              <div className="flex items-center justify-between gap-3 px-1 text-small text-muted">
                <span data-testid="illegal-count">
                  Illegal attempts <span className="font-semibold tabular text-ink">{game.illegalAttempts}</span>
                </span>
                <span>
                  Peeks used <span className="font-semibold tabular text-ink">{game.peeksUsed}</span>
                </span>
                <IconButton label="Flip board (F)" onClick={() => setOrientation((o) => (o === "white" ? "black" : "white"))} size="sm">
                  <IconFlip size={17} />
                </IconButton>
              </div>
            </>
          )}
        </aside>
      </div>

      <Modal
        open={confirmResign}
        onClose={() => setConfirmResign(false)}
        title="Resign this game?"
        description={rated ? "This counts as a loss for your blindfold rating." : "No worries: it's practice."}
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmResign(false)} data-autofocus>
            Keep playing
          </Button>
          <Button variant="danger" onClick={resign} data-testid="confirm-resign">
            Resign
          </Button>
        </div>
      </Modal>

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Shortcuts and input" closeButton>
        <ul className="space-y-2.5 text-[0.9375rem] text-fg">
          <li className="flex items-center justify-between gap-4">
            <span>Peek at the board</span>
            <span className="flex items-center gap-1">
              <Kbd>P</Kbd> or <Kbd>Alt</Kbd>+<Kbd>P</Kbd>
            </span>
          </li>
          <li className="flex items-center justify-between gap-4">
            <span>Speak a move</span>
            <span className="flex items-center gap-1">
              <Kbd>M</Kbd> or <Kbd>Alt</Kbd>+<Kbd>M</Kbd>
            </span>
          </li>
          <li className="flex items-center justify-between gap-4">
            <span>Focus the move box</span>
            <Kbd>/</Kbd>
          </li>
          <li className="flex items-center justify-between gap-4">
            <span>Flip the board</span>
            <Kbd>F</Kbd>
          </li>
          <li className="flex items-center justify-between gap-4">
            <span>Move a cursor on the board</span>
            <span className="flex items-center gap-1">
              <Kbd>←</Kbd>
              <Kbd>→</Kbd>
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> + <Kbd>Enter</Kbd>
            </span>
          </li>
        </ul>
        <p className="mt-5 text-small text-muted">
          Type moves as SAN (<strong className="text-ink">Nf3</strong>, <strong className="text-ink">exd5</strong>, <strong className="text-ink">O-O</strong>), as coordinates (
          <strong className="text-ink">g1f3</strong>) or in words (<strong className="text-ink">knight to f3</strong>, <strong className="text-ink">castle long</strong>).
        </p>
      </Modal>
    </div>
  );
}
