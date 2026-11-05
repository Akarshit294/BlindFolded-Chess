import type { Metadata } from "next";
import { WherePieceDrill } from "@/components/drills/WherePieceDrill";
import { PageShell } from "@/components/layout/PageShell";

export const metadata: Metadata = { title: "Where's the piece?" };

export default function Page() {
  return (
    <PageShell>
      <WherePieceDrill />
    </PageShell>
  );
}
