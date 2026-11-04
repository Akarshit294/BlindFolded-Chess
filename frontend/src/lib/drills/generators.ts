/**
 * Seeded question generators for the training drills. Pure functions (given an RNG), so they
 * are unit-tested and also used as the offline fallback for the backend drill endpoints.
 */
import { Chess, type Move, type PieceSymbol, type Square } from "chess.js";
import { PIECE_NAMES } from "@/lib/chess/notation";
import {
  ALL_SQUARES,
  countShortestKnightPaths,
  emptyBoardReach,
  fileIndex,
  isSquare,
  knightDistance,
  knightDistances,
  rankIndex,
  sameDiagonal,
  sameFile,
  sameRank,
  shortestKnightPath,
  squareShade,
  squaresBetween,
  type Orientation,
} from "@/lib/chess/squares";
import { pick, randInt, shuffle, type Rng } from "@/lib/utils/random";

/* ------------------------------------------------------------------ square colour */
export type SquareColorQ = { kind: "single"; square: Square; answer: "light" | "dark" } | { kind: "pair"; a: Square; b: Square; answer: boolean };

export function squareColorQuestion(level: number, rng: Rng): SquareColorQ {
  if (level >= 4) {
    const a = pick(rng, ALL_SQUARES);
    let b = pick(rng, ALL_SQUARES);
    while (b === a) b = pick(rng, ALL_SQUARES);
    return { kind: "pair", a, b, answer: squareShade(a) === squareShade(b) };
  }
  const square = pick(rng, ALL_SQUARES);
  return { kind: "single", square, answer: squareShade(square) };
}

/* ------------------------------------------------------------------ coordinates */
export type CoordinateQ = { mode: "find" | "name"; square: Square; orientation: Orientation; showCoords: boolean };

export function coordinateQuestion(level: number, rng: Rng): CoordinateQ {
  const square = pick(rng, ALL_SQUARES);
  switch (level) {
    case 1:
      return { mode: "find", square, orientation: "white", showCoords: true };
    case 2:
      return { mode: "find", square, orientation: "white", showCoords: false };
    case 3:
      return { mode: "name", square, orientation: "white", showCoords: false };
    case 4:
      return { mode: rng() < 0.5 ? "find" : "name", square, orientation: "black", showCoords: false };
    default:
      return { mode: rng() < 0.5 ? "find" : "name", square, orientation: rng() < 0.5 ? "white" : "black", showCoords: false };
  }
}

/* ------------------------------------------------------------------ knight routes */
export type KnightRouteQ = { from: Square; to: Square; distance: number; blocked: Square[]; example: Square[]; paths: number };

const KNIGHT_LEVELS: Array<[number, number]> = [
  [1, 2],
  [3, 3],
  [4, 6],
  [2, 5],
];

export function knightRouteQuestion(level: number, rng: Rng): KnightRouteQ {
  const [min, max] = KNIGHT_LEVELS[Math.max(0, Math.min(KNIGHT_LEVELS.length - 1, level - 1))]!;
  for (let attempt = 0; attempt < 500; attempt++) {
    const from = pick(rng, ALL_SQUARES);
    const blocked = new Set<Square>();
    if (level >= 4) {
      // A handful of forbidden squares (think: squares guarded by enemy pawns).
      const count = randInt(rng, 3, 6);
      for (const sq of shuffle(rng, ALL_SQUARES)) {
        if (blocked.size >= count) break;
        if (sq !== from) blocked.add(sq);
      }
    }
    const dist = knightDistances(from, blocked);
    const candidates = [...dist.entries()].filter(([sq, d]) => d >= min && d <= max && !blocked.has(sq)).map(([sq]) => sq);
    if (candidates.length === 0) continue;
    const to = pick(rng, candidates);
    if (level >= 4 && knightDistance(from, to, blocked) === knightDistance(from, to)) continue; // obstacles must matter
    const example = shortestKnightPath(from, to, blocked)!;
    return { from, to, distance: example.length - 1, blocked: [...blocked], example, paths: countShortestKnightPaths(from, to, blocked) };
  }
  // Fallback that always exists.
  return { from: "b1", to: "c3", distance: 1, blocked: [], example: ["b1", "c3"], paths: 1 };
}

/** Parses "c3 d5 f6", "b1-c3-d5", "Nc3, Nd5" into squares. */
export function parseSquareList(text: string): Square[] {
  return (text.toLowerCase().match(/[a-h][1-8]/g) ?? []).filter(isSquare) as Square[];
}

/** Checks a typed route; the start/end squares may be included or left out. */
export function checkKnightRoute(q: KnightRouteQ, typed: Square[]): { correct: boolean; reason?: string } {
  let path = [...typed];
  if (path[0] !== q.from) path = [q.from, ...path];
  if (path[path.length - 1] !== q.to) path = [...path, q.to];
  const blocked = new Set(q.blocked);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const df = Math.abs(fileIndex(a) - fileIndex(b));
    const dr = Math.abs(rankIndex(a) - rankIndex(b));
    if (!((df === 1 && dr === 2) || (df === 2 && dr === 1))) return { correct: false, reason: `${a} → ${b} is not a knight move.` };
    if (blocked.has(b)) return { correct: false, reason: `${b} is forbidden.` };
  }
  if (path.length - 1 > q.distance) return { correct: false, reason: `That takes ${path.length - 1} moves; ${q.distance} is enough.` };
  return { correct: true };
}

/* ------------------------------------------------------------------ diagonals & lines */
export type LineQ =
  | { kind: "same-diagonal"; a: Square; b: Square; answer: boolean }
  | { kind: "same-line"; a: Square; b: Square; answer: "diagonal" | "rank" | "file" | "none" }
  | { kind: "between"; a: Square; b: Square; answer: Square[] }
  | { kind: "reach"; piece: PieceSymbol; square: Square; answer: number };

function lineOf(a: Square, b: Square): "diagonal" | "rank" | "file" | "none" {
  if (sameDiagonal(a, b)) return "diagonal";
  if (sameRank(a, b)) return "rank";
  if (sameFile(a, b)) return "file";
  return "none";
}

export function lineQuestion(level: number, rng: Rng): LineQ {
  const a = pick(rng, ALL_SQUARES);
  if (level <= 1) {
    // Half the time pick a square that really is on a diagonal with `a`.
    const diag = ALL_SQUARES.filter((s) => sameDiagonal(s, a));
    const b = rng() < 0.5 && diag.length ? pick(rng, diag) : pick(rng, ALL_SQUARES.filter((s) => s !== a));
    return { kind: "same-diagonal", a, b, answer: sameDiagonal(a, b) };
  }
  if (level === 2) {
    const onLine = ALL_SQUARES.filter((s) => s !== a && lineOf(a, s) !== "none");
    const b = rng() < 0.65 ? pick(rng, onLine) : pick(rng, ALL_SQUARES.filter((s) => s !== a));
    return { kind: "same-line", a, b, answer: lineOf(a, b) };
  }
  if (level === 3) {
    const far = ALL_SQUARES.filter((s) => s !== a && lineOf(a, s) !== "none" && squaresBetween(a, s).length >= 2);
    const b = pick(rng, far);
    return { kind: "between", a, b, answer: squaresBetween(a, b) };
  }
  const piece = pick(rng, ["b", "r", "q", "n", "k"] as PieceSymbol[]);
  return { kind: "reach", piece, square: a, answer: emptyBoardReach(piece, a).length };
}

export function lineQuestionText(q: LineQ): string {
  switch (q.kind) {
    case "same-diagonal":
      return `Are ${q.a} and ${q.b} on the same diagonal?`;
    case "same-line":
      return `Do ${q.a} and ${q.b} share a diagonal, a rank, a file — or nothing?`;
    case "between":
      return `Name every square between ${q.a} and ${q.b}.`;
    case "reach":
      return `On an empty board, how many squares can a ${PIECE_NAMES[q.piece]} on ${q.square} move to?`;
  }
}

/* ------------------------------------------------------------------ natural move sequences */
const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function moveWeight(chess: Chess, move: Move, ply: number, lastPly: boolean): number {
  let w = 1;
  const castle = move.flags.includes("k") || move.flags.includes("q");
  if (move.san.includes("#")) return lastPly ? 3 : 0;
  if (ply < 12) {
    if (move.piece === "p" && "cde".includes(move.from[0]!) && Math.abs(rankIndex(move.to) - rankIndex(move.from)) >= 1) w += 4;
    if ((move.piece === "n" || move.piece === "b") && (move.from[1] === "1" || move.from[1] === "8")) w += 5;
    if (move.piece === "q") w *= 0.25;
    if (move.piece === "r" && !castle) w *= 0.3;
    if (move.piece === "k" && !castle) w *= 0.03;
    if (move.piece === "p" && "abgh".includes(move.from[0]!)) w *= 0.5;
    if ((move.piece === "n") && "ah".includes(move.to[0]!)) w *= 0.4;
  } else if (move.piece === "k" && !castle) {
    w *= 0.2;
  }
  if (castle) w += 8;
  const opp = move.color === "w" ? "b" : "w";
  const after = new Chess(move.after);
  const attacked = after.isAttacked(move.to, opp);
  const defended = after.isAttacked(move.to, move.color);
  if (move.captured) {
    const gain = VALUE[move.captured] - (attacked ? VALUE[move.piece] : 0);
    w += gain > 0 ? 8 + gain * 2 : gain === 0 ? 4 : 0.2;
  } else if (attacked && move.piece !== "p" && (!defended || VALUE[move.piece] > 3)) {
    w *= 0.08; // don't hang pieces
  }
  if (move.san.includes("+")) w += 0.6;
  if (move.promotion && move.promotion !== "q") w *= 0.05;
  void chess;
  return Math.max(0, w);
}

export type MoveSequence = { sans: string[]; ucis: string[]; fen: string };

/** A natural-looking game fragment from the starting position (no engine needed). */
export function generateSequence(plies: number, rng: Rng): MoveSequence {
  for (let attempt = 0; attempt < 30; attempt++) {
    const chess = new Chess();
    const sans: string[] = [];
    const ucis: string[] = [];
    let ok = true;
    for (let ply = 0; ply < plies; ply++) {
      const moves = chess.moves({ verbose: true });
      if (moves.length === 0) {
        ok = false;
        break;
      }
      const weights = moves.map((m) => moveWeight(chess, m, ply, ply === plies - 1) ** 1.5);
      const total = weights.reduce((a, b) => a + b, 0);
      if (total <= 0) {
        ok = false;
        break;
      }
      let r = rng() * total;
      let chosen = moves[moves.length - 1]!;
      for (let i = 0; i < moves.length; i++) {
        r -= weights[i]!;
        if (r <= 0) {
          chosen = moves[i]!;
          break;
        }
      }
      chess.move(chosen);
      sans.push(chosen.san);
      ucis.push(chosen.lan);
      if (chess.isGameOver() && ply < plies - 1) {
        ok = false;
        break;
      }
    }
    if (ok) return { sans, ucis, fen: chess.fen() };
  }
  // Extremely unlikely; a classic line as a safety net.
  const fallback = ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5", "Bb3", "d6", "c3", "O-O"];
  const chess = new Chess();
  const sans: string[] = [];
  const ucis: string[] = [];
  for (const s of fallback.slice(0, Math.min(plies, fallback.length))) {
    const m = chess.move(s);
    sans.push(m.san);
    ucis.push(m.lan);
  }
  return { sans, ucis, fen: chess.fen() };
}

/* ------------------------------------------------------------------ where's the piece */
export type WhereQ =
  | { kind: "on-square"; square: Square; answer: string }
  | { kind: "where-is"; color: "w" | "b"; piece: PieceSymbol; answer: Square[] }
  | { kind: "legal"; san: string; answer: boolean };

export function describeSquareContent(chess: Chess, sq: Square): string {
  const p = chess.get(sq);
  if (!p) return "empty";
  return `${p.color === "w" ? "white" : "black"} ${PIECE_NAMES[p.type]}`;
}

/** Three questions about the final position: what's on a square, where is a piece, is a move legal. */
export function wherePieceQuestions(seq: MoveSequence, rng: Rng): WhereQ[] {
  const chess = new Chess(seq.fen);
  const out: WhereQ[] = [];

  // 1. What's on a square — prefer squares touched by the moves.
  const touched = [...new Set(seq.ucis.flatMap((u) => [u.slice(0, 2), u.slice(2, 4)]))].filter(isSquare) as Square[];
  const sq = pick(rng, touched.length ? touched : ALL_SQUARES);
  out.push({ kind: "on-square", square: sq, answer: describeSquareContent(chess, sq) });

  // 2. Where is a piece that has moved (unique-ish).
  const movedTo = seq.ucis.map((u) => u.slice(2, 4) as Square).filter((s) => {
    const p = chess.get(s);
    return p && p.type !== "p";
  });
  const target = movedTo.length ? pick(rng, movedTo) : (chess.findPiece({ type: "k", color: "w" })[0] as Square);
  const tp = chess.get(target)!;
  out.push({ kind: "where-is", color: tp.color, piece: tp.type, answer: chess.findPiece({ type: tp.type, color: tp.color }) as Square[] });

  // 3. Is a move legal? Half legal, half a plausible-but-illegal move.
  const legal = chess.moves({ verbose: true });
  if (rng() < 0.5 && legal.length) {
    out.push({ kind: "legal", san: pick(rng, legal).san, answer: true });
  } else {
    const illegal = plausibleIllegalMove(chess, rng);
    if (illegal) out.push({ kind: "legal", san: illegal, answer: false });
    else if (legal.length) out.push({ kind: "legal", san: pick(rng, legal).san, answer: true });
  }
  return out;
}

/** A SAN string that looks like a real move for the side to move but is not legal. */
function plausibleIllegalMove(chess: Chess, rng: Rng): string | null {
  const turn = chess.turn();
  const legalSans = new Set(chess.moves().map((s) => s.replace(/[+#]/g, "")));
  const mine = chess.board().flat().filter((p): p is NonNullable<typeof p> => !!p && p.color === turn && p.type !== "k");
  for (let i = 0; i < 60; i++) {
    const p = pick(rng, mine.length ? mine : chess.board().flat().filter((x): x is NonNullable<typeof x> => !!x));
    const reach = p.type === "p" ? [] : emptyBoardReach(p.type, p.square);
    if (reach.length === 0) continue;
    const to = pick(rng, reach);
    const target = chess.get(to);
    if (target && target.color === turn) continue;
    const san = `${p.type.toUpperCase()}${target ? "x" : ""}${to}`;
    if (!legalSans.has(san) && !chess.moves().some((s) => s.replace(/[+#]/g, "").endsWith(to) && s.startsWith(p.type.toUpperCase()))) return san;
  }
  return null;
}

/* ------------------------------------------------------------------ memory positions */
const MEMORY_PIECES: PieceSymbol[] = ["q", "r", "r", "b", "b", "n", "n", "p", "p", "p", "p", "p", "p"];

/** A random legal position with `count` pieces (both kings included). */
export function randomPosition(count: number, rng: Rng): string {
  for (let attempt = 0; attempt < 400; attempt++) {
    const board = new Map<Square, { type: PieceSymbol; color: "w" | "b" }>();
    const free = () => ALL_SQUARES.filter((s) => !board.has(s));
    const wk = pick(rng, ALL_SQUARES);
    board.set(wk, { type: "k", color: "w" });
    const bkOptions = free().filter((s) => Math.max(Math.abs(fileIndex(s) - fileIndex(wk)), Math.abs(rankIndex(s) - rankIndex(wk))) > 1);
    board.set(pick(rng, bkOptions), { type: "k", color: "b" });
    const pool = shuffle(rng, [...MEMORY_PIECES.map((t) => ({ type: t, color: "w" as const })), ...MEMORY_PIECES.map((t) => ({ type: t, color: "b" as const }))]);
    for (const piece of pool) {
      if (board.size >= count) break;
      const options = free().filter((s) => (piece.type === "p" ? s[1] !== "1" && s[1] !== "8" : true));
      if (!options.length) continue;
      board.set(pick(rng, options), piece);
    }
    const chess = new Chess();
    chess.clear();
    for (const [sq, p] of board) chess.put(p, sq);
    // Side to move: White. Black must not be in check (it would be White's capture).
    const fen = chess.fen().replace(/ [wb] /, " w ");
    try {
      const test = new Chess(fen);
      const flipped = new Chess(fen.replace(" w ", " b "));
      if (flipped.inCheck()) continue;
      if (test.isGameOver()) continue;
      return fen;
    } catch {
      continue;
    }
  }
  return "4k3/8/8/8/8/8/8/4K3 w - - 0 1";
}

/** Scores a rebuilt position against the target: correct squares / (target pieces + extras). */
export function scoreMemory(target: Map<Square, string>, placed: Map<Square, string>): { correct: number; missing: Square[]; wrong: Square[]; extra: Square[]; accuracy: number } {
  let correct = 0;
  const missing: Square[] = [];
  const wrong: Square[] = [];
  const extra: Square[] = [];
  for (const [sq, piece] of target) {
    const p = placed.get(sq);
    if (p === piece) correct++;
    else if (p) wrong.push(sq);
    else missing.push(sq);
  }
  for (const sq of placed.keys()) if (!target.has(sq)) extra.push(sq);
  const accuracy = correct / Math.max(1, target.size + extra.length);
  return { correct, missing, wrong, extra, accuracy };
}

export function boardMapFromFen(fen: string): Map<Square, string> {
  const chess = new Chess(fen, { skipValidation: true });
  const map = new Map<Square, string>();
  for (const row of chess.board()) for (const c of row) if (c) map.set(c.square, `${c.color}${c.type}`);
  return map;
}
