import type { Metadata } from "next";
import { SquareColorDrill } from "@/components/drills/SquareColorDrill";
import { PageShell } from "@/components/layout/PageShell";

export const metadata: Metadata = { title: "Square colour" };

export default function Page() {
  return (
    <PageShell>
      <SquareColorDrill />
    </PageShell>
  );
}
