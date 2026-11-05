import type { Visibility } from "@/lib/storage/types";

/** The five ways to take the board away, from easiest to hardest. */
export const VISIBILITY_MODES: Array<{ id: Visibility; name: string; blurb: string; difficulty: number }> = [
  { id: "full", name: "Full board", blurb: "A warm-up with every piece in sight.", difficulty: 0 },
  { id: "ghost", name: "Ghost", blurb: "Pieces fade a few seconds after each move.", difficulty: 1 },
  { id: "silhouette", name: "Silhouette", blurb: "You see where pieces stand, not which ones.", difficulty: 2 },
  { id: "empty", name: "Empty board", blurb: "Only coordinates. The last move flashes.", difficulty: 3 },
  { id: "blind", name: "Total blindfold", blurb: "No board at all: moves and memory.", difficulty: 4 },
];

export function modeName(v: Visibility): string {
  return VISIBILITY_MODES.find((m) => m.id === v)?.name ?? v;
}
