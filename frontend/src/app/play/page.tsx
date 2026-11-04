import type { Metadata } from "next";
import { PageShell } from "@/components/layout/PageShell";
import { PlayClient } from "@/components/game/PlayClient";

export const metadata: Metadata = {
  title: "Play blindfolded",
  description: "Play Stockfish with the board hidden: ghost, silhouette, empty-board or total blindfold modes.",
};

export default function PlayPage() {
  return (
    <PageShell>
      <PlayClient />
    </PageShell>
  );
}
