import type { Metadata } from "next";
import { TrainHub } from "@/components/drills/TrainHub";
import { PageShell } from "@/components/layout/PageShell";

export const metadata: Metadata = { title: "Train", description: "Visualisation drills for blindfold chess: square colours, coordinates, knight routes, lines, memory and more." };

export default function TrainPage() {
  return (
    <PageShell>
      <TrainHub />
    </PageShell>
  );
}
