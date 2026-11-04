/**
 * Forgiving move input: SAN ("Nf3", "exd5", "e8=Q", "O-O"), UCI / long algebraic ("e2e4",
 * "g1-f3", "e7e8q"), lower-case SAN ("nf3", "bxc6") and natural language ("knight to f3",
 * "castle long"). Everything resolves against the list of legal moves in the position.
 */
import type { Chess, Move, PieceSymbol, Square } from "chess.js";
import { parseNaturalMove, type MoveSpec } from "./voice";

export type { MoveSpec };

export type MoveResolution =
  | { status: "empty" }
  | { status: "invalid"; message: string }
  | { status: "legal"; move: Move }
  | { status: "promotion"; candidates: Move[] }
  | { status: "ambiguous"; candidates: Move[]; message: string }
  | { status: "illegal"; message: string };

const FIGURINE_MAP: Record<string, string> = {
  "♔": "K", "♕": "Q", "♖": "R", "♗": "B", "♘": "N", "♙": "",
  "♚": "K", "♛": "Q", "♜": "R", "♝": "B", "♞": "N", "♟": "",
};

/** Normalises unicode and strips annotations: "♘f3+!" -> "Nf3". */
export function cleanMoveText(raw: string): string {
  return raw
    .trim()
    .replace(/[♔♕♖♗♘♙♚♛♜♝♞♟]/g, (m) => FIGURINE_MAP[m] ?? "")
    .replace(/[×:]/g, "x")
    .replace(/[–—]/g, "-")
    .replace(/\s*(e\.?p\.?)\s*$/i, "")
    .replace(/[+#!?]+$/g, "")
    .trim();
}

const UCI_RE = /^([KQRBN])?([a-h][1-8])\s*[-x]?\s*([a-h][1-8])\s*=?\s*([qrbnQRBN])?$/;
const SAN_RE = /^([KQRBNkqrnb])?([a-h])?([1-8])?(x)?([a-h][1-8])(?:=?([QRBNqrbn]))?$/;

/**
 * Parses strict(ish) notation into one or more interpretations, most likely first.
 * Returns [] when the text is not move notation (the caller may try natural language).
 */
export function parseNotation(raw: string): MoveSpec[] {
  const text = cleanMoveText(raw);
  if (!text) return [];
  const compact = text.replace(/\s+/g, "");

  if (/^[0oO]-?[0oO]-?[0oO]$/.test(compact)) return [{ castle: "q" }];
  if (/^[0oO]-?[0oO]$/.test(compact)) return [{ castle: "k" }];

  const uci = UCI_RE.exec(compact);
  if (uci) {
    const [, piece, from, to, promo] = uci;
    const spec: MoveSpec = { from: from as Square, to: to as Square };
    if (piece) spec.piece = piece.toLowerCase() as PieceSymbol;
    if (promo) spec.promotion = promo.toLowerCase() as PieceSymbol;
    return [spec];
  }

  const san = SAN_RE.exec(compact);
  if (!san) return [];
  const [, pieceRaw, fromFile, fromRank, capture, to, promo] = san;
  const base: MoveSpec = { to: to as Square };
  if (capture) base.capture = true;
  if (promo) base.promotion = promo.toLowerCase() as PieceSymbol;

  const out: MoveSpec[] = [];
  if (pieceRaw) {
    const asPiece: MoveSpec = { ...base, piece: pieceRaw.toLowerCase() as PieceSymbol };
    if (fromFile) asPiece.fromFile = fromFile;
    if (fromRank) asPiece.fromRank = fromRank;
    out.push(asPiece);
    // Lower-case "b" may also be the b-file: "bc4" / "bxc4" (pawn capture).
    if (pieceRaw === "b" && !fromFile && !fromRank) {
      out.push({ ...base, piece: "p", fromFile: "b" });
    }
  } else {
    const pawn: MoveSpec = { ...base, piece: "p" };
    if (fromFile) pawn.fromFile = fromFile;
    if (fromRank) pawn.fromRank = fromRank;
    out.push(pawn);
  }
  return out;
}

/** All interpretations of free text: notation first, then natural language. */
export function interpretMoveText(raw: string): MoveSpec[] {
  const notation = parseNotation(raw);
  if (notation.length > 0) return notation;
  const natural = parseNaturalMove(cleanMoveText(raw));
  if (!natural) return [];
  // "e4" said out loud means a pawn move; "knight f3" names the piece.
  if (!natural.castle && natural.piece === undefined && !natural.from) natural.piece = "p";
  return [natural];
}

function isCastle(move: Move, side: "k" | "q"): boolean {
  return move.flags.includes(side);
}

/** Legal moves that satisfy a spec. */
export function matchSpec(spec: MoveSpec, legal: Move[]): Move[] {
  return legal.filter((m) => {
    if (spec.castle) {
      if (spec.castle === "any") return isCastle(m, "k") || isCastle(m, "q");
      return isCastle(m, spec.castle);
    }
    if (spec.piece && m.piece !== spec.piece) return false;
    if (spec.from && m.from !== spec.from) return false;
    if (spec.fromFile && m.from[0] !== spec.fromFile) return false;
    if (spec.fromRank && m.from[1] !== spec.fromRank) return false;
    if (spec.to && m.to !== spec.to) return false;
    if (spec.capture && !m.captured) return false;
    if (spec.promotion && m.promotion !== spec.promotion) return false;
    return true;
  });
}

function uniqueMoves(moves: Move[]): Move[] {
  const seen = new Set<string>();
  return moves.filter((m) => {
    const key = m.lan;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Resolves free text to a legal move in the given position. */
export function resolveMoveText(raw: string, chess: Chess): MoveResolution {
  if (!raw.trim()) return { status: "empty" };
  const specs = interpretMoveText(raw);
  if (specs.length === 0) return { status: "invalid", message: "That doesn't look like a move." };
  return resolveSpecs(specs, chess.moves({ verbose: true }));
}

export function resolveSpecs(specs: MoveSpec[], legal: Move[]): MoveResolution {
  for (const spec of specs) {
    const candidates = uniqueMoves(matchSpec(spec, legal));
    if (candidates.length === 0) continue;
    if (candidates.length === 1) return { status: "legal", move: candidates[0]! };
    const sameSquares = candidates.every((c) => c.from === candidates[0]!.from && c.to === candidates[0]!.to);
    if (sameSquares && candidates.every((c) => c.promotion)) return { status: "promotion", candidates };
    return {
      status: "ambiguous",
      candidates,
      message: `Ambiguous — did you mean ${candidates.map((c) => c.san).join(" or ")}?`,
    };
  }
  return { status: "illegal", message: describeIllegal(specs[0]!) };
}

function describeIllegal(spec: MoveSpec): string {
  if (spec.castle) return "Castling isn't legal here.";
  if (spec.to) return `No legal move to ${spec.to}${spec.piece && spec.piece !== "p" ? " for that piece" : ""}.`;
  return "That move isn't legal.";
}

/** Syntax-only check used in rated mode (does not leak legality). */
export function looksLikeMove(raw: string): boolean {
  return interpretMoveText(raw).length > 0;
}

/**
 * Simplifies SAN for prefix comparisons: lower-case, no capture/check markers.
 * "Nxf7+" -> "nf7", "exd5" -> "ed5", "O-O" -> "o-o".
 */
function simplify(s: string): string {
  return cleanMoveText(s).toLowerCase().replace(/x/g, "").replace(/=/g, "").replace(/0/g, "o").replace(/\s+/g, "");
}

/** Legal-move autocomplete for typed input (practice mode). Most relevant first. */
export function autocompleteMoves(raw: string, legal: Move[], limit = 6): Move[] {
  const typed = simplify(raw);
  if (!typed) return [];
  const scored: Array<{ m: Move; score: number }> = [];
  for (const m of legal) {
    const san = simplify(m.san);
    const lan = m.lan.toLowerCase();
    let score = -1;
    if (san === typed || lan === typed) score = 100;
    else if (san.startsWith(typed)) score = 60 - san.length;
    else if (lan.startsWith(typed)) score = 40 - lan.length;
    if (score >= 0) scored.push({ m, score });
  }
  scored.sort((a, b) => b.score - a.score || a.m.san.localeCompare(b.m.san));
  return scored.slice(0, limit).map((s) => s.m);
}
