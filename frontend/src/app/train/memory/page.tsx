import type { Metadata } from "next";
import { MemoryDrill } from "@/components/drills/MemoryDrill";
import { PageShell } from "@/components/layout/PageShell";

export const metadata: Metadata = { title: "Memory" };

export default function Page() {
  return (
    <PageShell>
      <MemoryDrill />
    </PageShell>
  );
}
