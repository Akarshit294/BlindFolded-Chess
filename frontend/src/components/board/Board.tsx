"use client";
/**
 * The chessboard. Rendering only — rules live in the parent (chess.js).
 *
 * Layers (bottom → top): squares, highlights, coordinates, arrows, pieces, effects, fog, overlays.
 * Pieces keep a stable identity across positions (see tracking.ts) so they spring from square
 * to square; drags are driven by motion values (no React re-render per pointer move).
 */
import type { Color, PieceSymbol, Square } from "chess.js";
import { Chess } from "chess.js";
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  type MotionValue,
  type Transition,
} from "motion/react";
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ALL_SQUARES, gridToSquare, squareShade, squareToGrid, type Orientation } from "@/lib/chess/squares";
import { useSettings } from "@/lib/settings/store";
import { cn } from "@/lib/utils/cn";
import { Arrows, type BoardArrow } from "./Arrows";
import { Fog } from "./Fog";
import { PieceGlyph } from "./PieceGlyph";
import { PromotionPicker } from "./PromotionPicker";
import { Shatter } from "./Shatter";
import { trackPieces, type MoveHint, type Placement, type TrackedPiece } from "./tracking";

export type Visibility = "full" | "ghost" | "silhouette" | "empty";
export type MoveResult = "ok" | "illegal" | "promotion";
export type SquareMark = "good" | "bad" | "focus" | "target" | "path" | "dim";
export type LastMove = { from: Square; to: Square; flags?: string; promotion?: PieceSymbol; captured?: PieceSymbol } | null;

export type BoardHandle = {
  /** Shakes the board (illegal attempt feedback). */
  shake: () => void;
  /** Spawns a ghost trail along a move. */
  trail: (from: Square, to: Square) => void;
  /** Briefly flashes squares (empty-board mode). */
  flash: (squares: Square[]) => void;
};

export type BoardProps = {
  fen: string;
  orientation?: Orientation;
  lastMove?: LastMove;
  visibility?: Visibility;
  /** Forces full visibility (peek, game over). */
  reveal?: boolean;
  interactive?: boolean;
  /** Whose pieces the user may move ("both" for analysis/drills). */
  movableColor?: Color | "both";
  /** Legal moves for hints/magnet (only used when pieces are visible). */
  legalMoves?: Array<{ from: Square; to: Square; promotion?: PieceSymbol }>;
  showLegalHints?: boolean;
  onMove?: (from: Square, to: Square, promotion?: PieceSymbol) => MoveResult;
  /** Square-click mode (drills): every click is reported, no move logic. */
  onSquareClick?: (sq: Square) => void;
  checkSquare?: Square | null;
  matedSquare?: Square | null;
  arrows?: BoardArrow[];
  marks?: Partial<Record<Square, SquareMark>>;
  coordinates?: "edge" | "all" | "none";
  ghostDelayMs?: number;
  speed?: "normal" | "slow";
  fog?: number;
  className?: string;
  ariaLabel?: string;
  /** Called with the square under the keyboard cursor (for screen-reader announcements). */
  onCursor?: (sq: Square) => void;
};

type Fx =
  | { id: number; kind: "shatter"; square: Square; color: Color; type: PieceSymbol; delay: number }
  | { id: number; kind: "fade"; square: Square; color: Color; type: PieceSymbol }
  | { id: number; kind: "trail"; from: Square; to: Square }
  | { id: number; kind: "flash"; square: Square };

const SPRING: Transition = { type: "spring", stiffness: 520, damping: 38, mass: 0.9 };
const SPRING_SLOW: Transition = { type: "spring", stiffness: 90, damping: 18, mass: 1.2 };
const SETTLE: Transition = { type: "spring", stiffness: 700, damping: 34 };
const RETURN: Transition = { type: "spring", stiffness: 420, damping: 22 };

function placementsFromFen(fen: string): Placement[] {
  const out: Placement[] = [];
  try {
    const chess = new Chess(fen, { skipValidation: true });
    for (const row of chess.board()) for (const c of row) if (c) out.push({ square: c.square, type: c.type, color: c.color });
  } catch {
    // Invalid FEN: render an empty board rather than crashing.
  }
  return out;
}

/* ------------------------------------------------------------------------------------------ */

type PieceViewProps = {
  piece: TrackedPiece;
  orientation: Orientation;
  set: string;
  visible: boolean;
  silhouette: boolean;
  dragging: boolean;
  dragX: MotionValue<number>;
  dragY: MotionValue<number>;
  takeDrop: (id: string) => { x: number; y: number } | null;
  delay: number;
  slow: boolean;
  toppled: boolean;
  fadeDelay: number;
  reduced: boolean;
  hidden: boolean;
};

const PieceView = memo(function PieceView({
  piece,
  orientation,
  set,
  visible,
  silhouette,
  dragging,
  dragX,
  dragY,
  takeDrop,
  delay,
  slow,
  toppled,
  fadeDelay,
  reduced,
  hidden,
}: PieceViewProps) {
  const { col, row } = squareToGrid(piece.square, orientation);
  const x = useMotionValue(`${col * 100}%`);
  const y = useMotionValue(`${row * 100}%`);
  const ox = useMotionValue(0);
  const oy = useMotionValue(0);
  const first = useRef(true);

  useLayoutEffect(() => {
    const tx = `${col * 100}%`;
    const ty = `${row * 100}%`;
    if (first.current) {
      first.current = false;
      x.jump(tx);
      y.jump(ty);
      return;
    }
    const drop = takeDrop(piece.id);
    if (drop) {
      x.jump(tx);
      y.jump(ty);
      ox.jump(drop.x);
      oy.jump(drop.y);
      if (reduced) {
        ox.jump(0);
        oy.jump(0);
      } else {
        animate(ox, 0, SETTLE);
        animate(oy, 0, SETTLE);
      }
      return;
    }
    if (reduced) {
      x.jump(tx);
      y.jump(ty);
      return;
    }
    const t = { ...(slow ? SPRING_SLOW : SPRING), delay };
    const ax = animate(x, tx, t);
    const ay = animate(y, ty, t);
    return () => {
      ax.stop();
      ay.stop();
    };
  }, [col, row, piece.id, x, y, ox, oy, takeDrop, delay, slow, reduced]);

  return (
    <motion.div
      className="pointer-events-none absolute left-0 top-0 h-[12.5%] w-[12.5%]"
      style={{ x, y, zIndex: dragging ? 30 : 10 }}
      data-piece={`${piece.color}${piece.type}`}
      data-square={piece.square}
      aria-hidden="true"
    >
      <motion.div className="relative h-full w-full" style={{ x: dragging ? dragX : ox, y: dragging ? dragY : oy }}>
        {/* Lift shadow: opacity only. */}
        <motion.div
          className="absolute inset-x-[16%] bottom-[2%] h-[22%] rounded-[50%] bg-black/45 blur-[6px]"
          initial={false}
          animate={{ opacity: dragging ? 1 : 0, scale: dragging ? 1.15 : 0.8 }}
          transition={{ duration: 0.18 }}
        />
        <motion.div
          className="relative h-full w-full"
          initial={hidden ? { opacity: 0 } : false}
          animate={{
            opacity: visible ? 1 : 0,
            scale: dragging ? 1.14 : visible ? 1 : 0.94,
            y: dragging ? "-8%" : visible ? "0%" : "-6%",
            rotate: toppled ? (piece.color === "w" ? 82 : -82) : 0,
          }}
          transition={{
            opacity: { duration: visible ? 0.28 : 0.9, delay: visible ? 0 : fadeDelay, ease: [0.16, 1, 0.3, 1] },
            scale: { type: "spring", stiffness: 600, damping: 30 },
            y: { duration: visible ? 0.25 : 0.9, delay: visible ? 0 : fadeDelay },
            rotate: { type: "spring", stiffness: 60, damping: 9, delay: 0.5 },
          }}
          style={{ transformOrigin: toppled ? "50% 86%" : "50% 50%", willChange: "transform, opacity" }}
        >
          {silhouette ? (
            <div className="absolute inset-[24%] rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(235,238,255,0.95),rgba(156,167,240,0.65)_60%,rgba(93,102,192,0.35))] shadow-[0_0_18px_rgba(156,167,240,0.45)]" />
          ) : (
            <PieceGlyph set={set} color={piece.color} type={piece.type} className="h-full w-full" />
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
});

/* ------------------------------------------------------------------------------------------ */

export const Board = forwardRef<BoardHandle, BoardProps>(function Board(
  {
    fen,
    orientation = "white",
    lastMove = null,
    visibility = "full",
    reveal = false,
    interactive = true,
    movableColor = "w",
    legalMoves,
    showLegalHints = true,
    onMove,
    onSquareClick,
    checkSquare = null,
    matedSquare = null,
    arrows = [],
    marks,
    coordinates = "edge",
    ghostDelayMs = 3000,
    speed = "normal",
    fog,
    className,
    ariaLabel = "Chessboard",
    onCursor,
  },
  ref,
) {
  const pieceSet = useSettings((s) => s.pieceSet);
  const showCoords = useSettings((s) => s.coordinates);
  const motionPref = useSettings((s) => s.motion);
  const systemReduced = useReducedMotion();
  const reduced = motionPref === "reduced" || (motionPref === "system" && !!systemReduced);

  const boardRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [hover, setHover] = useState<Square | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [cursor, setCursor] = useState<Square | null>(null);
  const [keyboardActive, setKeyboardActive] = useState(false);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square; color: Color } | null>(null);
  const [fx, setFx] = useState<Fx[]>([]);
  const shakeX = useMotionValue(0);
  const fxId = useRef(0);
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const drops = useRef(new Map<string, { x: number; y: number }>());
  const dragState = useRef<{
    pointerId: number;
    piece: TrackedPiece;
    startX: number;
    startY: number;
    originCx: number;
    originCy: number;
    active: boolean;
  } | null>(null);

  /* ---------- piece identity ---------- */
  const tracked = useRef<{ fen: string; pieces: TrackedPiece[]; removed: TrackedPiece[]; removedFor: string }>({
    fen: "",
    pieces: [],
    removed: [],
    removedFor: "",
  });
  const pieces = useMemo(() => {
    const t = tracked.current;
    if (t.fen === fen) return t.pieces;
    const hint: MoveHint | null = lastMove ? { from: lastMove.from, to: lastMove.to, promotion: lastMove.promotion } : null;
    const { pieces: next, removed } = trackPieces(t.pieces, placementsFromFen(fen), hint);
    tracked.current = { fen, pieces: next, removed: t.fen ? removed : [], removedFor: fen };
    return next;
  }, [fen, lastMove]);

  const piecesRendered = useMemo(() => {
    if (!promotion) return pieces;
    // While choosing a promotion piece, show the pawn on its destination.
    return pieces.map((p) => (p.square === promotion.from ? { ...p, square: promotion.to } : p));
  }, [pieces, promotion]);

  /* Captured pieces shatter; pieces vanishing on a position jump fade gently. */
  useEffect(() => {
    const t = tracked.current;
    if (t.removedFor !== fen || t.removed.length === 0) return;
    const removed = t.removed;
    t.removed = [];
    const isCapture = !!lastMove;
    setFx((cur) => [
      ...cur,
      ...removed.map((p): Fx => {
        fxId.current += 1;
        return isCapture
          ? { id: fxId.current, kind: "shatter", square: p.square, color: p.color, type: p.type, delay: reduced ? 0 : 0.12 }
          : { id: fxId.current, kind: "fade", square: p.square, color: p.color, type: p.type };
      }),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen]);

  /* ---------- visibility ---------- */
  const [ghostShown, setGhostShown] = useState(true);
  useEffect(() => {
    if (visibility !== "ghost") return;
    setGhostShown(true);
    const t = window.setTimeout(() => setGhostShown(false), ghostDelayMs);
    return () => window.clearTimeout(t);
  }, [fen, visibility, ghostDelayMs]);

  const piecesVisible = reveal || visibility === "full" || (visibility === "ghost" && ghostShown) || visibility === "silhouette";
  const silhouette = !reveal && visibility === "silhouette";
  const piecesHidden = !piecesVisible;
  const canDrag = interactive && !onSquareClick && (reveal || visibility === "full" || (visibility === "ghost" && ghostShown));
  const fogDensity = fog ?? (reveal || visibility === "full" ? 0 : visibility === "ghost" ? (ghostShown ? 0 : 0.5) : visibility === "silhouette" ? 0.3 : 0.55);

  /* ---------- effects API ---------- */
  const doShake = useCallback(() => {
    if (reduced) return;
    animate(shakeX, [0, -8, 7, -5, 3, 0], { duration: 0.4, ease: "easeOut" });
  }, [reduced, shakeX]);
  const spawn = useCallback((items: Fx[]) => setFx((cur) => [...cur, ...items]), []);
  useImperativeHandle(
    ref,
    () => ({
      shake: () => doShake(),
      trail: (from, to) => {
        fxId.current += 1;
        spawn([{ id: fxId.current, kind: "trail", from, to }]);
      },
      flash: (squares) =>
        spawn(
          squares.map((square) => {
            fxId.current += 1;
            return { id: fxId.current, kind: "flash", square };
          }),
        ),
    }),
    [spawn, doShake],
  );
  const removeFx = useCallback((id: number) => setFx((cur) => cur.filter((f) => f.id !== id)), []);

  useEffect(() => {
    setSelected(null);
  }, [fen]);

  /* ---------- geometry helpers ---------- */
  const pointToSquare = useCallback(
    (clientX: number, clientY: number): Square | null => {
      const el = boardRef.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const col = Math.floor(((clientX - r.left) / r.width) * 8);
      const row = Math.floor(((clientY - r.top) / r.height) * 8);
      return gridToSquare(col, row, orientation);
    },
    [orientation],
  );
  const squareCenter = useCallback(
    (sq: Square) => {
      const el = boardRef.current;
      const size = el ? el.getBoundingClientRect().width / 8 : 0;
      const { col, row } = squareToGrid(sq, orientation);
      return { x: (col + 0.5) * size, y: (row + 0.5) * size, size };
    },
    [orientation],
  );

  const pieceAt = useCallback((sq: Square) => pieces.find((p) => p.square === sq) ?? null, [pieces]);
  const isMovable = useCallback(
    (p: TrackedPiece | null) => !!p && (movableColor === "both" || p.color === movableColor),
    [movableColor],
  );
  const targetsFrom = useCallback(
    (sq: Square | null) => (sq && legalMoves ? new Set(legalMoves.filter((m) => m.from === sq).map((m) => m.to)) : new Set<Square>()),
    [legalMoves],
  );

  /* ---------- move attempts ---------- */
  const attempt = useCallback(
    (from: Square, to: Square, promo?: PieceSymbol): MoveResult => {
      if (!onMove) return "illegal";
      const res = onMove(from, to, promo);
      if (res === "promotion") {
        const p = pieceAt(from);
        setPromotion({ from, to, color: p?.color ?? (movableColor === "b" ? "b" : "w") });
      } else if (res === "illegal") {
        doShake();
      }
      return res;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onMove, pieceAt, movableColor],
  );

  const handleSquareActivate = useCallback(
    (sq: Square) => {
      if (onSquareClick) {
        onSquareClick(sq);
        return;
      }
      if (!interactive) return;
      const piece = piecesVisible && !silhouette ? pieceAt(sq) : null;
      if (!selected) {
        if (piecesVisible && !silhouette && !isMovable(piece)) return;
        setSelected(sq);
        return;
      }
      if (selected === sq) {
        setSelected(null);
        return;
      }
      if (piecesVisible && !silhouette && isMovable(piece)) {
        setSelected(sq);
        return;
      }
      const from = selected;
      setSelected(null);
      attempt(from, sq);
    },
    [onSquareClick, interactive, piecesVisible, silhouette, pieceAt, selected, isMovable, attempt],
  );

  /* ---------- pointer handling ---------- */
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || promotion) return;
    setKeyboardActive(false);
    const sq = pointToSquare(e.clientX, e.clientY);
    if (!sq) return;
    const piece = pieceAt(sq);
    if (canDrag && piece && isMovable(piece)) {
      const c = squareCenter(sq);
      const r = boardRef.current!.getBoundingClientRect();
      dragState.current = {
        pointerId: e.pointerId,
        piece,
        startX: e.clientX,
        startY: e.clientY,
        originCx: r.left + c.x,
        originCy: r.top + c.y,
        active: false,
      };
      boardRef.current?.setPointerCapture(e.pointerId);
    } else {
      dragState.current = null;
      handleSquareActivate(sq);
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragState.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dist = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
    if (!d.active) {
      if (dist < 4) return;
      d.active = true;
      dragX.jump(0);
      dragY.jump(0);
      setDraggingId(d.piece.id);
      setSelected(d.piece.square);
    }
    const sq = pointToSquare(e.clientX, e.clientY);
    let px = e.clientX;
    let py = e.clientY;
    // Magnetic snap toward the hovered square's centre (stronger for legal targets).
    if (sq && sq !== d.piece.square) {
      const r = boardRef.current!.getBoundingClientRect();
      const c = squareCenter(sq);
      const cx = r.left + c.x;
      const cy = r.top + c.y;
      const legal = !legalMoves || targetsFrom(d.piece.square).has(sq);
      const pull = (legal ? 0.42 : 0.12) * Math.max(0, 1 - Math.hypot(px - cx, py - cy) / (c.size * 0.75));
      px += (cx - px) * pull;
      py += (cy - py) * pull;
    }
    dragX.set(px - d.originCx);
    dragY.set(py - d.originCy);
    if (sq !== hover) setHover(sq);
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = dragState.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragState.current = null;
    boardRef.current?.releasePointerCapture?.(e.pointerId);
    setHover(null);
    if (!d.active) {
      // A click on a movable piece.
      handleSquareActivate(d.piece.square);
      return;
    }
    const to = cancelled ? null : pointToSquare(e.clientX, e.clientY);
    const springBack = () => {
      Promise.all([animate(dragX, 0, RETURN).finished, animate(dragY, 0, RETURN).finished]).then(() => setDraggingId(null));
    };
    if (!to || to === d.piece.square) {
      springBack();
      return;
    }
    // Register where the piece was dropped so it settles from there into the square.
    const c = squareCenter(to);
    const r = boardRef.current!.getBoundingClientRect();
    drops.current.set(d.piece.id, { x: d.originCx + dragX.get() - (r.left + c.x), y: d.originCy + dragY.get() - (r.top + c.y) });
    setSelected(null);
    const res = attempt(d.piece.square, to);
    if (res === "ok") {
      setDraggingId(null);
    } else {
      drops.current.delete(d.piece.id);
      if (res === "promotion") {
        setDraggingId(null);
        dragX.jump(0);
        dragY.jump(0);
      } else springBack();
    }
  };

  const takeDrop = useCallback((id: string) => {
    const v = drops.current.get(id) ?? null;
    drops.current.delete(id);
    return v;
  }, []);

  /* ---------- keyboard ---------- */
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (promotion) return;
    const moves: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    };
    if (e.key in moves) {
      e.preventDefault();
      setKeyboardActive(true);
      const cur = cursor ?? (orientation === "white" ? "e2" : "e7");
      const { col, row } = squareToGrid(cur, orientation);
      const [dc, dr] = moves[e.key]!;
      const next = gridToSquare(Math.max(0, Math.min(7, col + dc)), Math.max(0, Math.min(7, row + dr)), orientation) ?? cur;
      setCursor(next);
      onCursor?.(next);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setKeyboardActive(true);
      const sq = cursor ?? (orientation === "white" ? "e2" : "e7");
      if (!cursor) setCursor(sq);
      handleSquareActivate(sq);
    } else if (e.key === "Escape") {
      setSelected(null);
    }
  };

  /* ---------- derived highlight data ---------- */
  const hintTargets = useMemo(
    () => (showLegalHints && piecesVisible && !silhouette ? targetsFrom(selected) : new Set<Square>()),
    [showLegalHints, piecesVisible, silhouette, targetsFrom, selected],
  );
  const occupied = useMemo(() => new Set(pieces.map((p) => p.square)), [pieces]);
  const showLastMove = !!lastMove && (reveal || visibility === "full" || visibility === "ghost" || visibility === "silhouette");
  const coordMode = !showCoords && coordinates === "edge" ? "none" : visibility === "empty" && !reveal && coordinates !== "none" ? "all" : coordinates;

  const slow = speed === "slow";

  return (
    <motion.div className={cn("relative aspect-square w-full select-none", className)} style={{ x: shakeX }}>
      <div
        ref={boardRef}
        role="application"
        aria-roledescription="chessboard"
        aria-label={ariaLabel}
        tabIndex={interactive || onSquareClick ? 0 : -1}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endDrag(e, false)}
        onPointerCancel={(e) => endDrag(e, true)}
        onKeyDown={onKeyDown}
        onBlur={() => setKeyboardActive(false)}
        className={cn(
          "relative h-full w-full overflow-hidden rounded-[10px] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.06)] outline-none",
          "touch-none",
          (interactive || onSquareClick) && "cursor-pointer",
        )}
        style={{ background: "var(--board-frame)" }}
      >
        {/* Squares */}
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: "var(--sq-light)",
            // a8 (top-left as White) and h1 (top-left as Black) are both light squares.
            backgroundImage: "repeating-conic-gradient(var(--sq-dark) 0% 25%, var(--sq-light) 0% 50%)",
            backgroundSize: "25% 25%",
          }}
        />

        {/* Highlights */}
        <div className="pointer-events-none absolute inset-0">
          {showLastMove && lastMove
            ? [lastMove.from, lastMove.to].map((sq) => <SquareTint key={`lm-${sq}`} square={sq} orientation={orientation} color="var(--hl-last)" />)
            : null}
          {marks
            ? (Object.entries(marks) as Array<[Square, SquareMark]>).map(([sq, kind]) => (
                <MarkTint key={`mk-${sq}-${kind}`} square={sq} orientation={orientation} kind={kind} />
              ))
            : null}
          {selected ? <SquareTint key={`sel-${selected}`} square={selected} orientation={orientation} color="var(--hl-select)" /> : null}
          {hover && draggingId ? <SquareRing square={hover} orientation={orientation} /> : null}
          {checkSquare && (piecesVisible || reveal) ? <CheckGlow square={checkSquare} orientation={orientation} mated={false} /> : null}
          {matedSquare ? <CheckGlow square={matedSquare} orientation={orientation} mated /> : null}
          {[...hintTargets].map((sq) => (
            <HintDot key={`hint-${sq}`} square={sq} orientation={orientation} capture={occupied.has(sq)} />
          ))}
          {keyboardActive && cursor ? <SquareRing square={cursor} orientation={orientation} strong /> : null}
        </div>

        {/* Coordinates */}
        {coordMode !== "none" ? <Coordinates orientation={orientation} mode={coordMode} /> : null}

        {/* Arrows */}
        {arrows.length ? <Arrows arrows={arrows} orientation={orientation} /> : null}

        {/* Pieces */}
        <div className="pointer-events-none absolute inset-0">
          {piecesRendered.map((p) => {
            const castleRook =
              !!lastMove?.flags && /[kq]/.test(lastMove.flags) && p.type === "r" && p.color === pieceAt(lastMove.to)?.color;
            return (
              <PieceView
                key={p.id}
                piece={p}
                orientation={orientation}
                set={pieceSet}
                visible={piecesVisible}
                silhouette={silhouette}
                dragging={draggingId === p.id}
                dragX={dragX}
                dragY={dragY}
                takeDrop={takeDrop}
                delay={castleRook ? 0.16 : 0}
                slow={slow}
                toppled={matedSquare === p.square && p.type === "k"}
                fadeDelay={((p.square.charCodeAt(0) * 7 + p.square.charCodeAt(1) * 3) % 8) * 0.06}
                reduced={reduced}
                hidden={piecesHidden}
              />
            );
          })}
        </div>

        {/* Effects */}
        <div className="pointer-events-none absolute inset-0">
          {fx.map((f) => {
            if (f.kind === "trail") return <GhostTrail key={f.id} from={f.from} to={f.to} orientation={orientation} onDone={() => removeFx(f.id)} />;
            if (f.kind === "flash") return <Flash key={f.id} square={f.square} orientation={orientation} onDone={() => removeFx(f.id)} />;
            const { col, row } = squareToGrid(f.square, orientation);
            return (
              <div key={f.id} className="absolute h-[12.5%] w-[12.5%]" style={{ left: `${col * 12.5}%`, top: `${row * 12.5}%`, zIndex: 20 }}>
                {f.kind === "shatter" && piecesVisible && !silhouette ? (
                  <Shatter set={pieceSet} color={f.color} type={f.type} delay={f.delay} onDone={() => removeFx(f.id)} />
                ) : (
                  <FadeOut set={pieceSet} color={f.color} type={f.type} visible={piecesVisible && !silhouette} onDone={() => removeFx(f.id)} />
                )}
              </div>
            );
          })}
        </div>

        {/* Fog */}
        <Fog density={reduced ? Math.min(fogDensity, 0.4) : fogDensity} />

        {/* Promotion */}
        <AnimatePresence>
          {promotion ? (
            <PromotionPicker
              square={promotion.to}
              color={promotion.color}
              orientation={orientation}
              set={pieceSet}
              onCancel={() => setPromotion(null)}
              onPick={(p) => {
                const pr = promotion;
                setPromotion(null);
                attempt(pr.from, pr.to, p);
              }}
            />
          ) : null}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});

/* ------------------------------------------------------------------------------------------ */

function squareStyle(sq: Square, orientation: Orientation) {
  const { col, row } = squareToGrid(sq, orientation);
  return { left: `${col * 12.5}%`, top: `${row * 12.5}%`, width: "12.5%", height: "12.5%" } as const;
}

function SquareTint({ square, orientation, color }: { square: Square; orientation: Orientation; color: string }) {
  return (
    <motion.div
      className="absolute"
      style={{ ...squareStyle(square, orientation), background: color }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    />
  );
}

const MARK_STYLES: Record<SquareMark, string> = {
  good: "bg-jade-400/55",
  bad: "bg-coral-400/55",
  focus: "bg-ember-400/70 shadow-[inset_0_0_0_3px_rgba(255,255,255,0.65)]",
  target: "bg-moon-400/55",
  path: "bg-ember-300/45",
  dim: "bg-night-950/45",
};

function MarkTint({ square, orientation, kind }: { square: Square; orientation: Orientation; kind: SquareMark }) {
  return (
    <motion.div
      className={cn("absolute", MARK_STYLES[kind])}
      style={squareStyle(square, orientation)}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
    />
  );
}

function SquareRing({ square, orientation, strong }: { square: Square; orientation: Orientation; strong?: boolean }) {
  return (
    <div className="absolute p-[2px]" style={squareStyle(square, orientation)}>
      <div className={cn("h-full w-full rounded-[4px]", strong ? "ring-[3px] ring-moon-200" : "ring-[3px] ring-ivory-50/70")} />
    </div>
  );
}

function HintDot({ square, orientation, capture }: { square: Square; orientation: Orientation; capture: boolean }) {
  return (
    <motion.div
      className="absolute flex items-center justify-center"
      style={squareStyle(square, orientation)}
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 600, damping: 28 }}
    >
      {capture ? (
        <div className="h-[92%] w-[92%] rounded-full ring-[5px] ring-[var(--hl-target)]" />
      ) : (
        <div className="h-[30%] w-[30%] rounded-full" style={{ background: "var(--hl-target)" }} />
      )}
    </motion.div>
  );
}

function CheckGlow({ square, orientation, mated }: { square: Square; orientation: Orientation; mated: boolean }) {
  return (
    <div className="absolute" style={squareStyle(square, orientation)}>
      <div
        className={cn("absolute -inset-[30%] rounded-full", mated ? "" : "animate-glow-pulse")}
        style={{
          background: mated
            ? "radial-gradient(closest-side, rgba(240,70,55,0.95), rgba(200,40,30,0.55) 45%, rgba(200,40,30,0) 75%)"
            : "radial-gradient(closest-side, rgba(255,110,90,0.9), rgba(255,80,60,0.45) 45%, rgba(255,80,60,0) 75%)",
        }}
      />
    </div>
  );
}

function Coordinates({ orientation, mode }: { orientation: Orientation; mode: "edge" | "all" }) {
  if (mode === "all") {
    return (
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {ALL_SQUARES.map((sq) => {
          const dark = squareShade(sq) === "dark";
          return (
            <div key={sq} className="absolute flex items-center justify-center" style={squareStyle(sq, orientation)}>
              <span
                className="font-mono text-[clamp(8px,1.6vw,13px)] font-medium opacity-60"
                style={{ color: dark ? "var(--sq-coord-dark)" : "var(--sq-coord-light)" }}
              >
                {sq}
              </span>
            </div>
          );
        })}
      </div>
    );
  }
  const files = orientation === "white" ? "abcdefgh" : "hgfedcba";
  const ranks = orientation === "white" ? "87654321" : "12345678";
  return (
    <div className="pointer-events-none absolute inset-0 font-mono text-[clamp(8px,1.5vw,12px)] font-semibold" aria-hidden="true">
      {ranks.split("").map((r, i) => {
        const sq = `${files[0]}${r}` as Square;
        const dark = squareShade(sq) === "dark";
        return (
          <span
            key={`r${r}`}
            className="absolute left-[0.35%] leading-none"
            style={{ top: `calc(${i * 12.5}% + 0.45%)`, color: dark ? "var(--sq-coord-dark)" : "var(--sq-coord-light)" }}
          >
            {r}
          </span>
        );
      })}
      {files.split("").map((f, i) => {
        const sq = `${f}${ranks[7]}` as Square;
        const dark = squareShade(sq) === "dark";
        return (
          <span
            key={`f${f}`}
            className="absolute bottom-[0.3%] leading-none"
            style={{ left: `calc(${(i + 1) * 12.5}% - 1.6%)`, color: dark ? "var(--sq-coord-dark)" : "var(--sq-coord-light)" }}
          >
            {f}
          </span>
        );
      })}
    </div>
  );
}

function GhostTrail({ from, to, orientation, onDone }: { from: Square; to: Square; orientation: Orientation; onDone: () => void }) {
  const a = squareToGrid(from, orientation);
  const b = squareToGrid(to, orientation);
  const x1 = a.col + 0.5;
  const y1 = a.row + 0.5;
  const x2 = b.col + 0.5;
  const y2 = b.row + 0.5;
  return (
    <svg viewBox="0 0 8 8" className="absolute inset-0 h-full w-full overflow-visible">
      <defs>
        <linearGradient id={`trail-${from}-${to}`} x1={x1} y1={y1} x2={x2} y2={y2} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="rgba(191,199,251,0)" />
          <stop offset="1" stopColor="rgba(220,225,255,0.95)" />
        </linearGradient>
      </defs>
      <motion.line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={`url(#trail-${from}-${to})`}
        strokeWidth={0.26}
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0.9 }}
        animate={{ pathLength: 1, opacity: 0 }}
        transition={{ pathLength: { duration: 0.45, ease: [0.16, 1, 0.3, 1] }, opacity: { duration: 1.6, delay: 0.3 } }}
        onAnimationComplete={onDone}
      />
      <motion.circle
        cx={x2}
        cy={y2}
        r={0.42}
        fill="rgba(220,225,255,0.5)"
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{ opacity: [0, 0.8, 0], scale: [0.3, 1.2, 1.5] }}
        transition={{ duration: 1.2, delay: 0.25 }}
        style={{ transformOrigin: `${x2}px ${y2}px`, transformBox: "fill-box" }}
      />
    </svg>
  );
}

function Flash({ square, orientation, onDone }: { square: Square; orientation: Orientation; onDone: () => void }) {
  return (
    <motion.div
      className="absolute bg-ember-300/80"
      style={squareStyle(square, orientation)}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.9, 0.9, 0] }}
      transition={{ duration: 1.6, times: [0, 0.12, 0.5, 1] }}
      onAnimationComplete={onDone}
    />
  );
}

function FadeOut({
  set,
  color,
  type,
  visible,
  onDone,
}: {
  set: string;
  color: Color;
  type: PieceSymbol;
  visible: boolean;
  onDone: () => void;
}) {
  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: visible ? 1 : 0, scale: 1 }}
      animate={{ opacity: 0, scale: 0.85, y: "-10%" }}
      transition={{ duration: 0.35 }}
      onAnimationComplete={onDone}
    >
      <PieceGlyph set={set} color={color} type={type} className="h-full w-full" />
    </motion.div>
  );
}

