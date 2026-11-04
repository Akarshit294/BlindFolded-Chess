import type { Metadata } from "next";
import { PageShell } from "@/components/layout/PageShell";
import { PuzzleTrainer } from "@/components/puzzles/PuzzleTrainer";

export const metadata: Metadata = {
  title: "Blindfold puzzles",
  description: "Chess puzzles given only as text: find mate in 1, 2 or 3, or the winning move, without seeing the board.",
};

export default function PuzzlesPage() {
  return (
    <PageShell>
      <PuzzleTrainer />
    </PageShell>
  );
}
