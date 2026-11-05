import type { Metadata } from "next";
import { PageShell } from "@/components/layout/PageShell";
import { PlayClient } from "@/components/game/PlayClient";

export const metadata: Metadata = {
  title: "Play blindfold",
  description: "Play Stockfish while the pieces fade and the board melts: ghost, silhouette, empty-board or total blindfold.",
};

export default function PlayPage() {
  return (
    <PageShell>
      <PlayClient />
    </PageShell>
  );
}
