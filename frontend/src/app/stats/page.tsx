import type { Metadata } from "next";
import { PageShell } from "@/components/layout/PageShell";
import { StatsDashboard } from "@/components/stats/StatsDashboard";

export const metadata: Metadata = { title: "Stats", description: "Your blindfold rating, puzzle rating, drill progress, streaks and game history." };

export default function StatsPage() {
  return (
    <PageShell>
      <StatsDashboard />
    </PageShell>
  );
}
