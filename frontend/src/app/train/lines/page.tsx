import type { Metadata } from "next";
import { LinesDrill } from "@/components/drills/LinesDrill";
import { PageShell } from "@/components/layout/PageShell";

export const metadata: Metadata = { title: "Diagonals & lines" };

export default function Page() {
  return (
    <PageShell>
      <LinesDrill />
    </PageShell>
  );
}
