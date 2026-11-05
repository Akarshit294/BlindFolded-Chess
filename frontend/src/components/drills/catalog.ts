/**
 * Drill metadata (names, levels, session lengths). Kept apart from the drill components so
 * that pages which only list drills — the Train hub and Stats — don't load every drill, the
 * board and chess.js.
 */
import type { DrillMeta } from "./DrillRunner";

export const SQUARE_COLOR_META: DrillMeta = {
  id: "square-color",
  display: ["Square", "colour"],
  title: "Square colour",
  tagline: "The foundation of board vision: know the colour of any square instantly, without looking.",
  levels: [
    { name: "Guided", blurb: "A colourless grid shows where the square is." },
    { name: "Blind", blurb: "Just the square's name. Picture it." },
    { name: "Quick", blurb: "No grid, and aim for under two seconds." },
    { name: "Pairs", blurb: "Are two squares the same colour?" },
  ],
  timedSeconds: 60,
  standardCount: 20,
  unit: "squares",
};

export const COORDINATES_META: DrillMeta = {
  id: "coordinates",
  display: ["Board", "coordinates"],
  title: "Coordinates",
  tagline: "Name the highlighted square, or find the named one — from both sides of the board, without labels.",
  levels: [
    { name: "Find, with labels", blurb: "Click the named square. Coordinates shown." },
    { name: "Find, no labels", blurb: "Click the named square on a bare board." },
    { name: "Name it", blurb: "A square lights up — type its name." },
    { name: "Black's side", blurb: "Find and name with the board flipped." },
    { name: "Mixed", blurb: "Random side, random task." },
  ],
  timedSeconds: 60,
  standardCount: 20,
  unit: "squares",
};

export const KNIGHT_META: DrillMeta = {
  id: "knight-routes",
  display: ["Knight", "routes"],
  title: "Knight routes",
  tagline: "Find the shortest knight path between two squares in your head. Type the squares the knight lands on.",
  levels: [
    { name: "Hops", blurb: "One or two moves away." },
    { name: "Journeys", blurb: "Exactly three moves." },
    { name: "Expeditions", blurb: "Four to six moves — corner to corner." },
    { name: "Minefield", blurb: "Avoid forbidden squares on the way." },
  ],
  timedSeconds: 120,
  standardCount: 10,
  unit: "routes",
};

export const LINES_META: DrillMeta = {
  id: "lines",
  display: ["Diagonals", "and lines"],
  title: "Diagonals & lines",
  tagline: "See which squares share diagonals, ranks and files — the highways bishops, rooks and queens travel.",
  levels: [
    { name: "Same diagonal?", blurb: "Yes or no for two squares." },
    { name: "Which line?", blurb: "Diagonal, rank, file — or none." },
    { name: "In between", blurb: "Name every square between two squares." },
    { name: "Reach", blurb: "How many squares does a piece control on an empty board?" },
  ],
  timedSeconds: 90,
  standardCount: 15,
  unit: "questions",
};

export const WHERE_META: DrillMeta = {
  id: "where-piece",
  display: ["Where's the", "piece?"],
  title: "Where's the piece?",
  tagline: "Read (or listen to) a game from the start, play it in your head, then answer questions about the final position.",
  levels: [
    { name: "Two moves", blurb: "4 plies. Moves stay visible." },
    { name: "Four moves", blurb: "8 plies. Moves stay visible." },
    { name: "Six moves", blurb: "12 plies. Moves hide when you're ready." },
    { name: "Nine moves", blurb: "18 plies. Moves hide when you're ready." },
    { name: "By ear", blurb: "12 plies, read aloud only." },
  ],
  timedSeconds: 180,
  standardCount: 5,
  unit: "games",
};

export const MEMORY_META: DrillMeta = {
  id: "memory",
  display: ["Position", "memory"],
  title: "Memory",
  tagline: "A position appears for a few seconds. Then the board clears — rebuild it piece by piece.",
  levels: [
    { name: "Glimpse", blurb: "4 pieces, 10 seconds." },
    { name: "Snapshot", blurb: "6 pieces, 10 seconds." },
    { name: "Scene", blurb: "8 pieces, 8 seconds." },
    { name: "Middlegame", blurb: "12 pieces, 8 seconds." },
    { name: "Photographic", blurb: "16 pieces, 6 seconds." },
  ],
  timedSeconds: 240,
  standardCount: 5,
  unit: "positions",
};

export const DRILLS = [SQUARE_COLOR_META, COORDINATES_META, KNIGHT_META, LINES_META, WHERE_META, MEMORY_META];
