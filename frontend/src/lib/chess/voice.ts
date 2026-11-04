/**
 * Turns loosely-worded move descriptions — typed ("knight to f3") or recognised from speech
 * ("night f three", "bishop takes see six", "castle long") — into a structured MoveSpec.
 */
import type { PieceSymbol, Square } from "chess.js";

export type MoveSpec = {
  /** "k" = kingside, "q" = queenside, "any" = "castle" without a side. */
  castle?: "k" | "q" | "any";
  /** Piece type when specified. "p" means the user explicitly said "pawn". */
  piece?: PieceSymbol;
  from?: Square;
  fromFile?: string;
  fromRank?: string;
  to?: Square;
  capture?: boolean;
  promotion?: PieceSymbol;
};

type Token =
  | { t: "piece"; v: PieceSymbol }
  | { t: "file"; v: string }
  | { t: "rank"; v: string }
  | { t: "square"; v: Square }
  | { t: "capture" }
  | { t: "castle" }
  | { t: "side"; v: "k" | "q" }
  | { t: "promote" };

const PIECE_WORDS: Record<string, PieceSymbol> = {
  king: "k", kings: "k",
  queen: "q", queens: "q", quinn: "q",
  rook: "r", rooks: "r", rock: "r", rocks: "r", ruk: "r", brook: "r", rookie: "r", ruck: "r",
  bishop: "b", bishops: "b",
  knight: "n", knights: "n", night: "n", nights: "n", nite: "n", knite: "n", horse: "n",
  pawn: "p", pawns: "p", pond: "p", porn: "p", prawn: "p", paun: "p", pon: "p",
};

const FILE_WORDS: Record<string, string> = {
  a: "a", ay: "a", eh: "a", alpha: "a", alfa: "a",
  b: "b", be: "b", bee: "b", bea: "b", bravo: "b",
  c: "c", see: "c", sea: "c", si: "c", cee: "c", charlie: "c",
  d: "d", dee: "d", di: "d", delta: "d",
  e: "e", ee: "e", echo: "e",
  f: "f", ef: "f", eff: "f", foxtrot: "f",
  g: "g", gee: "g", ji: "g", jee: "g", golf: "g",
  h: "h", aitch: "h", haitch: "h", hotel: "h",
};

const RANK_WORDS: Record<string, string> = {
  "1": "1", one: "1", first: "1",
  "2": "2", two: "2", second: "2",
  "3": "3", three: "3", third: "3",
  "4": "4", four: "4", fourth: "4",
  "5": "5", five: "5", fifth: "5",
  "6": "6", six: "6", sixth: "6",
  "7": "7", seven: "7", seventh: "7",
  "8": "8", eight: "8", eighth: "8",
};

/** Homophones that only mean a rank when they directly follow a file letter ("e for" -> e4). */
const RANK_AFTER_FILE: Record<string, string> = {
  won: "1", to: "2", too: "2", tree: "3", free: "3", for: "4", fore: "4", fife: "5", sex: "6", sicks: "6", ate: "8",
};

const CAPTURE_WORDS = new Set(["takes", "take", "took", "taking", "captures", "capture", "captured", "x", "cross", "times", "eats"]);
const CASTLE_WORDS = new Set(["castle", "castles", "castling", "castled"]);
const PROMOTE_WORDS = new Set(["promote", "promotes", "promoting", "promotion", "promoted", "equals", "becomes", "queening"]);

const CASTLE_SYMBOLS = /^\s*[0o]\s*-?\s*[0o](\s*-?\s*[0o])?\s*[+#!?]*\s*$/i;

function tokenize(input: string, homophones = true): Token[] {
  const words = input
    .toLowerCase()
    .replace(/×/g, " x ")
    .replace(/'s\b/g, "s")
    .replace(/[.,!?;:"()+#=]/g, (m) => (m === "=" ? " equals " : " "))
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .split(/[\s\-_/]+/)
    .filter(Boolean);

  const tokens: Token[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    const next = words[i + 1];
    if (next === "side" && /^(kings?|queens?)$/.test(w)) {
      tokens.push({ t: "side", v: w.startsWith("k") ? "k" : "q" });
      i++;
      continue;
    }
    if (w === "kingside" || w === "short") {
      tokens.push({ t: "side", v: "k" });
      continue;
    }
    if (w === "queenside" || w === "long") {
      tokens.push({ t: "side", v: "q" });
      continue;
    }
    if (CASTLE_WORDS.has(w)) {
      tokens.push({ t: "castle" });
      continue;
    }
    const prev = tokens[tokens.length - 1];
    if (homophones && prev?.t === "file" && w in RANK_AFTER_FILE) {
      tokens.push({ t: "rank", v: RANK_AFTER_FILE[w]! });
      continue;
    }
    if (w in PIECE_WORDS) tokens.push({ t: "piece", v: PIECE_WORDS[w]! });
    else if (CAPTURE_WORDS.has(w)) tokens.push({ t: "capture" });
    else if (PROMOTE_WORDS.has(w)) tokens.push({ t: "promote" });
    else if (w in RANK_WORDS) tokens.push({ t: "rank", v: RANK_WORDS[w]! });
    else if (w in FILE_WORDS) tokens.push({ t: "file", v: FILE_WORDS[w]! });
    // Anything else ("to", "the", "check", noise from the recogniser) is ignored.
  }

  // Merge a file immediately followed by a rank into a square.
  const merged: Token[] = [];
  for (const tok of tokens) {
    const last = merged[merged.length - 1];
    if (tok.t === "rank" && last?.t === "file") merged[merged.length - 1] = { t: "square", v: `${last.v}${tok.v}` as Square };
    else merged.push(tok);
  }
  return merged;
}

/** Parses natural-language move descriptions. Returns null when nothing move-like was found. */
export function parseNaturalMove(input: string): MoveSpec | null {
  return parseNaturalMoves(input)[0] ?? null;
}

/**
 * Every plausible reading, most likely first. "rook a to d1" may be a rook from the a-file
 * or (misheard "two") a rook from a2; the caller keeps whichever is legal.
 */
export function parseNaturalMoves(input: string): MoveSpec[] {
  if (CASTLE_SYMBOLS.test(input)) {
    const count = (input.match(/[0o]/gi) ?? []).length;
    return [{ castle: count >= 3 ? "q" : "k" }];
  }
  const out: MoveSpec[] = [];
  const seen = new Set<string>();
  for (const homophones of [true, false]) {
    const spec = specFromTokens(tokenize(input, homophones));
    const key = JSON.stringify(spec);
    if (spec && !seen.has(key)) {
      seen.add(key);
      out.push(spec);
    }
  }
  return out;
}

function specFromTokens(tokens: Token[]): MoveSpec | null {
  if (tokens.length === 0) return null;

  if (tokens.some((t) => t.t === "castle")) {
    const side = tokens.find((t): t is { t: "side"; v: "k" | "q" } => t.t === "side");
    return { castle: side ? side.v : "any" };
  }

  const squareIdx = tokens.flatMap((t, i) => (t.t === "square" ? [i] : []));
  if (squareIdx.length === 0) return null;
  const lastSquare = squareIdx[squareIdx.length - 1]!;

  const spec: MoveSpec = {};
  spec.to = (tokens[lastSquare] as { t: "square"; v: Square }).v;
  if (squareIdx.length >= 2) spec.from = (tokens[squareIdx[squareIdx.length - 2]!] as { t: "square"; v: Square }).v;

  let promoteNext = false;
  tokens.forEach((t, i) => {
    if (t.t === "promote") {
      promoteNext = true;
      return;
    }
    if (t.t === "capture") spec.capture = true;
    if (t.t !== "piece") return;
    if (promoteNext || i > lastSquare) {
      spec.promotion = t.v;
      promoteNext = false;
    } else if (spec.piece === undefined) {
      spec.piece = t.v;
    }
  });

  // A lone file or rank before the destination disambiguates the origin ("knight b d2", "e takes d5").
  for (let i = 0; i < lastSquare; i++) {
    const t = tokens[i]!;
    if (t.t === "file") spec.fromFile = t.v;
    if (t.t === "rank") spec.fromRank = t.v;
  }
  if (spec.promotion === "k" || spec.promotion === "p") delete spec.promotion;
  return spec;
}

/** Canonical SAN-like text for a spec — used for display and tests ("Nf3", "Bxc6", "O-O-O"). */
export function specToText(spec: MoveSpec): string {
  if (spec.castle === "k") return "O-O";
  if (spec.castle === "q") return "O-O-O";
  if (spec.castle === "any") return "castle";
  const from = spec.from ?? `${spec.fromFile ?? ""}${spec.fromRank ?? ""}`;
  let letter = "";
  if (spec.piece && spec.piece !== "p") letter = spec.piece.toUpperCase();
  else if (spec.piece === "p" && !from && spec.capture) letter = "P";
  const promo = spec.promotion ? `=${spec.promotion.toUpperCase()}` : "";
  return `${letter}${from}${spec.capture ? "x" : ""}${spec.to ?? ""}${promo}`;
}

/** Speech recognition transcript -> canonical move text (or null if nothing recognisable). */
export function normalizeSpokenMove(transcript: string): string | null {
  const spec = parseNaturalMove(transcript);
  return spec ? specToText(spec) : null;
}
