"use client";
import { Chess, type Square } from "chess.js";
import { useMemo, useRef, useState } from "react";
import { Board, type BoardHandle, type LastMove, type Visibility } from "@/components/board/Board";

export default function DevBoard() {
  const chess = useRef(new Chess());
  const [fen, setFen] = useState(chess.current.fen());
  const [last, setLast] = useState<LastMove>(null);
  const [vis, setVis] = useState<Visibility>("full");
  const ref = useRef<BoardHandle>(null);
  const legal = useMemo(() => chess.current.moves({ verbose: true }), [fen]);
  return (
    <div className="mx-auto grid max-w-5xl gap-6 p-6 md:grid-cols-[1fr_240px]">
      <Board
        ref={ref}
        fen={fen}
        lastMove={last}
        visibility={vis}
        movableColor={chess.current.turn()}
        legalMoves={legal}
        checkSquare={chess.current.inCheck() ? (chess.current.findPiece({ type: "k", color: chess.current.turn() })[0] as Square) : null}
        onMove={(from, to, promotion) => {
          const ok = legal.filter((m) => m.from === from && m.to === to);
          if (!ok.length) return "illegal";
          if (ok.some((m) => m.promotion) && !promotion) return "promotion";
          const mv = chess.current.move({ from, to, promotion });
          setLast({ from: mv.from, to: mv.to, flags: mv.flags, promotion: mv.promotion, captured: mv.captured });
          setFen(chess.current.fen());
          ref.current?.trail(mv.from, mv.to);
          return "ok";
        }}
      />
      <div className="flex flex-col gap-2">
        {(["full", "ghost", "silhouette", "empty"] as Visibility[]).map((v) => (
          <button key={v} className="rounded bg-night-700 px-3 py-2 text-ivory-100" onClick={() => setVis(v)} data-vis={v}>
            {v}
          </button>
        ))}
        <button
          className="rounded bg-night-700 px-3 py-2 text-ivory-100"
          onClick={() => {
            chess.current.load("r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 2 3");
            setLast(null);
            setFen(chess.current.fen());
          }}
        >
          scholar
        </button>
        <div className="font-mono text-xs text-ivory-400">{fen}</div>
      </div>
    </div>
  );
}
