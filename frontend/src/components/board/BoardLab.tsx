"use client";
/** Development-only playground for board animations (see /lab). */
import { Chess, type Square } from "chess.js";
import { useMemo, useRef, useState } from "react";
import { Board, type BoardHandle, type LastMove, type Visibility } from "./Board";

const SCENARIOS: Array<{ id: string; fen: string; moves: string[]; visibility?: Visibility }> = [
  { id: "capture", fen: "rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", moves: ["Nxe5"] },
  { id: "castle", fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", moves: ["O-O"] },
  { id: "enpassant", fen: "rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3", moves: ["exf6"] },
  { id: "promotion", fen: "8/4P1k1/8/8/8/8/6K1/8 w - - 0 1", moves: ["e8=Q"] },
  { id: "check", fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", moves: ["Bc4", "Nc6", "Bxf7+"] },
  { id: "mate", fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 2 3", moves: ["Qxf7#"] },
  { id: "ghost", fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", moves: ["e4", "e5", "Nf3"], visibility: "ghost" },
];

type LabState = { fen: string; last: LastMove; visibility: Visibility };

export function BoardLab() {
  const ref = useRef<BoardHandle>(null);
  const [state, setState] = useState<LabState>({ fen: new Chess().fen(), last: null, visibility: "full" });
  const chess = useMemo(() => new Chess(state.fen), [state.fen]);
  const king = chess.findPiece({ type: "k", color: chess.turn() })[0] as Square | undefined;
  const mated = chess.isCheckmate() ? (king ?? null) : null;
  const check = !mated && chess.inCheck() ? (king ?? null) : null;

  const play = (fen: string, san: string, visibility: Visibility) => {
    const c = new Chess(fen);
    const mv = c.move(san);
    setState({ fen: c.fen(), last: { from: mv.from, to: mv.to, flags: mv.flags, promotion: mv.promotion, captured: mv.captured }, visibility });
    ref.current?.trail(mv.from, mv.to);
    return c.fen();
  };

  const run = (id: string) => {
    const s = SCENARIOS.find((x) => x.id === id)!;
    const vis = s.visibility ?? "full";
    setState({ fen: s.fen, last: null, visibility: vis });
    let fen = s.fen;
    s.moves.forEach((san, i) => {
      window.setTimeout(() => {
        fen = play(fen, san, vis);
      }, 700 + i * 900);
    });
  };

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 p-6 md:grid-cols-[minmax(0,1fr)_220px]">
      <Board
        ref={ref}
        fen={state.fen}
        lastMove={state.last}
        visibility={state.visibility}
        ghostDelayMs={1200}
        checkSquare={check}
        matedSquare={mated}
        speed={mated ? "slow" : "normal"}
        movableColor="both"
        legalMoves={chess.moves({ verbose: true })}
        onMove={(from, to, promotion) => {
          const ok = chess.moves({ verbose: true }).filter((m) => m.from === from && m.to === to);
          if (!ok.length) return "illegal";
          if (ok.some((m) => m.promotion) && !promotion) return "promotion";
          const c = new Chess(state.fen);
          const mv = c.move({ from, to, promotion });
          setState({ fen: c.fen(), last: { from: mv.from, to: mv.to, flags: mv.flags, promotion: mv.promotion, captured: mv.captured }, visibility: state.visibility });
          return "ok";
        }}
      />
      <div className="flex flex-col gap-2">
        {SCENARIOS.map((s) => (
          <button key={s.id} data-scenario={s.id} onClick={() => run(s.id)} className="rounded-lg bg-night-700 px-3 py-2 text-left text-sm text-ivory-100 hover:bg-night-600">
            {s.id}
          </button>
        ))}
        <button onClick={() => ref.current?.shake()} className="rounded-lg bg-night-700 px-3 py-2 text-left text-sm text-ivory-100">
          shake
        </button>
      </div>
    </div>
  );
}
