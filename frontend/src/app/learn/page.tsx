import type { Metadata } from "next";
import { LearnGuide } from "@/components/learn/LearnGuide";
import { PageShell } from "@/components/layout/PageShell";

export const metadata: Metadata = { title: "Learn", description: "How to build chess visualisation, a four-week blindfold training plan, and a short history of blindfold chess." };

export default function LearnPage() {
  return (
    <PageShell>
      <LearnGuide />
    </PageShell>
  );
}
