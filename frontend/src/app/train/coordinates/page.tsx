import type { Metadata } from "next";
import { CoordinatesDrill } from "@/components/drills/CoordinatesDrill";
import { PageShell } from "@/components/layout/PageShell";

export const metadata: Metadata = { title: "Coordinates" };

export default function Page() {
  return (
    <PageShell>
      <CoordinatesDrill />
    </PageShell>
  );
}
