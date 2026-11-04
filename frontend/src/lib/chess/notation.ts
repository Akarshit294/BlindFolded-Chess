/**
 * Human-readable notation helpers: piece names, figurines, spoken SAN and
 * text descriptions of positions ("White: Kg1, Qd1 … Black: …").
 */
import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import { fileIndex, rankIndex } from "./squares";

export const PIECE_NAMES: Record<PieceSymbol, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

export const PIECE_LETTERS: Record<PieceSymbol, string> = {
  p: "",
  n: "N",
  b: "B",
  r: "R",
  q: "Q",
  k: "K",
};

export const COLOR_NAMES: Record<Color, string> = { w: "white", b: "black" };

const FIGURINES: Record<string, string> = { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘" };

export function pieceLabel(color: Color, type: PieceSymbol): string {
  return `${COLOR_NAMES[color]} ${PIECE_NAMES[type]}`;
}

/** "Nf3" -> "♘f3" (only piece letters at the start, or after "=" for promotions). */
export function toFigurine(san: string): string {
  return san.replace(/^[KQRBN]/, (m) => FIGURINES[m] ?? m).replace(/=([QRBN])/, (_, p: string) => `=${FIGURINES[p] ?? p}`);
}

const SPOKEN_FILES: Record<string, string> = {
  a: "A",
  b: "B",
  c: "C",
  d: "D",
  e: "E",
  f: "F",
  g: "G",
  h: "H",
};

function spokenSquare(sq: string): string {
  return `${SPOKEN_FILES[sq[0] ?? ""] ?? sq[0]} ${sq[1]}`;
}

/** Turns SAN into a phrase suitable for speech synthesis or screen readers. */
export function sanToSpeech(san: string): string {
  const clean = san.replace(/[!?]+$/g, "");
  if (/^O-O-O/.test(clean)) return withSuffix("castles queenside", clean);
  if (/^O-O/.test(clean)) return withSuffix("castles kingside", clean);
  const m = /^([KQRBN])?([a-h])?([1-8])?(x)?([a-h][1-8])(?:=([QRBN]))?/.exec(clean);
  if (!m) return clean;
  const [, piece, fromFile, fromRank, capture, to, promo] = m;
  const parts: string[] = [];
  const pieceName = piece ? PIECE_NAMES[piece.toLowerCase() as PieceSymbol] : "pawn";
  if (piece) {
    parts.push(pieceName);
    if (fromFile || fromRank) parts.push(`${fromFile ? SPOKEN_FILES[fromFile] : ""}${fromRank ?? ""}`.trim());
  } else if (fromFile) {
    parts.push(SPOKEN_FILES[fromFile] ?? fromFile);
  }
  if (capture) parts.push("takes");
  parts.push(spokenSquare(to ?? ""));
  if (promo) parts.push(`promotes to ${PIECE_NAMES[promo.toLowerCase() as PieceSymbol]}`);
  return withSuffix(parts.join(" "), clean);
}

function withSuffix(text: string, san: string): string {
  if (san.endsWith("#")) return `${text}, checkmate`;
  if (san.endsWith("+")) return `${text}, check`;
  return text;
}

const ORDER: PieceSymbol[] = ["k", "q", "r", "b", "n", "p"];

export type PiecePlacement = { square: Square; type: PieceSymbol; color: Color };

export function piecesFromFen(fen: string): PiecePlacement[] {
  const chess = new Chess(fen, { skipValidation: true });
  const out: PiecePlacement[] = [];
  for (const row of chess.board()) {
    for (const cell of row) if (cell) out.push({ square: cell.square, type: cell.type, color: cell.color });
  }
  return out;
}

function sortByFileRank(a: Square, b: Square): number {
  return fileIndex(a) - fileIndex(b) || rankIndex(a) - rankIndex(b);
}

/** One side's pieces as text, e.g. "Kg1, Qd1, Rf1, pawns a2 b2". Empty string when none. */
export function describeSide(pieces: PiecePlacement[], color: Color): string {
  const groups: string[] = [];
  for (const type of ORDER) {
    const squares = pieces
      .filter((p) => p.color === color && p.type === type)
      .map((p) => p.square)
      .sort(sortByFileRank);
    if (squares.length === 0) continue;
    if (type === "p") groups.push(`${squares.length === 1 ? "pawn" : "pawns"} ${squares.join(" ")}`);
    else groups.push(...squares.map((s) => `${PIECE_LETTERS[type]}${s}`));
  }
  return groups.join(", ");
}

/** "White: Kg1, Qd1, pawns a2 b2. Black: Kg8, Rd8." — same format as the backend. */
export function describePosition(fen: string): string {
  const pieces = piecesFromFen(fen);
  const parts: string[] = [];
  const white = describeSide(pieces, "w");
  const black = describeSide(pieces, "b");
  if (white) parts.push(`White: ${white}.`);
  if (black) parts.push(`Black: ${black}.`);
  return parts.join(" ");
}

/** A spoken version of a side description ("king g1, queen d1, pawns a2, b2"). */
export function speakSide(pieces: PiecePlacement[], color: Color): string {
  const groups: string[] = [];
  for (const type of ORDER) {
    const squares = pieces
      .filter((p) => p.color === color && p.type === type)
      .map((p) => p.square)
      .sort(sortByFileRank);
    if (squares.length === 0) continue;
    const name = squares.length > 1 && type !== "k" ? `${PIECE_NAMES[type]}s` : PIECE_NAMES[type];
    groups.push(`${name} ${squares.map(spokenSquare).join(", ")}`);
  }
  return groups.join("; ");
}

/** Formats a list of SAN moves into numbered move text ("1. e4 e5 2. Nf3"). */
export function formatMoveList(sans: string[], startMoveNumber = 1, startColor: Color = "w"): string {
  const out: string[] = [];
  let num = startMoveNumber;
  let color = startColor;
  sans.forEach((san, i) => {
    if (color === "w") out.push(`${num}. ${san}`);
    else out.push(i === 0 ? `${num}... ${san}` : san);
    if (color === "b") num += 1;
    color = color === "w" ? "b" : "w";
  });
  return out.join(" ");
}

/** Pairs plies into rows for a move table. */
export function pairMoves<T>(plies: T[], startColor: Color = "w"): Array<{ number: number; white?: T; black?: T }> {
  const rows: Array<{ number: number; white?: T; black?: T }> = [];
  let i = 0;
  let number = 1;
  if (startColor === "b" && plies.length > 0) {
    rows.push({ number, black: plies[0] });
    i = 1;
    number++;
  }
  for (; i < plies.length; i += 2) {
    rows.push({ number, white: plies[i], black: plies[i + 1] });
    number++;
  }
  return rows;
}
