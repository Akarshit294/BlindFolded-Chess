import type { Metadata } from "next";
import { KnightRoutesDrill } from "@/components/drills/KnightRoutesDrill";
import { PageShell } from "@/components/layout/PageShell";

export const metadata: Metadata = { title: "Knight routes" };

export default function Page() {
  return (
    <PageShell>
      <KnightRoutesDrill />
    </PageShell>
  );
}
