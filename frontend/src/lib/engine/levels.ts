/**
 * Engine difficulty levels. The weakest levels sample from Stockfish's top moves with a
 * softmax temperature (and the occasional deliberate blunder) because even Skill Level 0 is
 * too strong for beginners; mid levels use UCI_LimitStrength + UCI_Elo; the top level is
 * unrestricted.
 */
export type EngineLevel = {
  id: number;
  name: string;
  elo: number;
  blurb: string;
  /** Search limits. */
  depth?: number;
  movetime?: number;
  /** UCI_LimitStrength + UCI_Elo. */
  uciElo?: number;
  /** Softmax sampling among MultiPV lines. */
  sample?: { multipv: number; temperature: number; blunderChance: number };
};

export const ENGINE_LEVELS: EngineLevel[] = [
  { id: 1, name: "Ember", elo: 400, blurb: "Barely awake. Leaves pieces hanging.", depth: 2, sample: { multipv: 10, temperature: 320, blunderChance: 0.35 } },
  { id: 2, name: "Candle", elo: 700, blurb: "Sees one-move threats, sometimes.", depth: 3, sample: { multipv: 8, temperature: 210, blunderChance: 0.2 } },
  { id: 3, name: "Lantern", elo: 1000, blurb: "Knows the basics, misses tactics.", depth: 5, sample: { multipv: 6, temperature: 120, blunderChance: 0.1 } },
  { id: 4, name: "Torch", elo: 1200, blurb: "A steady casual player.", depth: 7, sample: { multipv: 4, temperature: 60, blunderChance: 0.05 } },
  { id: 5, name: "Beacon", elo: 1400, blurb: "Club strength. Punishes loose pieces.", movetime: 400, uciElo: 1400 },
  { id: 6, name: "Lighthouse", elo: 1700, blurb: "Solid and tactical.", movetime: 500, uciElo: 1700 },
  { id: 7, name: "Moon", elo: 2000, blurb: "Expert. Plans ahead.", movetime: 600, uciElo: 2000 },
  { id: 8, name: "Comet", elo: 2300, blurb: "Master level precision.", movetime: 700, uciElo: 2300 },
  { id: 9, name: "Star", elo: 2600, blurb: "Grandmaster strength.", movetime: 900, uciElo: 2600 },
  { id: 10, name: "Supernova", elo: 3200, blurb: "Full Stockfish. Good luck.", movetime: 1200 },
];

export function getLevel(id: number): EngineLevel {
  return ENGINE_LEVELS.find((l) => l.id === id) ?? ENGINE_LEVELS[2]!;
}

/**
 * Picks a move from MultiPV lines with a softmax over centipawns (side-to-move POV).
 * `rand` is injectable for tests.
 */
export function sampleMove(
  lines: Array<{ move: string; cp: number }>,
  temperature: number,
  blunderChance: number,
  rand: () => number = Math.random,
): string | null {
  if (lines.length === 0) return null;
  if (lines.length > 1 && rand() < blunderChance) {
    // A "human" slip: any of the non-best candidates, uniformly.
    const idx = 1 + Math.floor(rand() * (lines.length - 1));
    return lines[idx]!.move;
  }
  const best = Math.max(...lines.map((l) => l.cp));
  const weights = lines.map((l) => Math.exp((l.cp - best) / Math.max(1, temperature)));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < lines.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return lines[i]!.move;
  }
  return lines[lines.length - 1]!.move;
}
