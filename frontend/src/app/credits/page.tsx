import type { Metadata } from "next";
import { CreditsList } from "@/components/credits/CreditsList";
import { PageShell } from "@/components/layout/PageShell";

export const metadata: Metadata = { title: "Credits", description: "Open-source software, data and assets used by Blindfold." };

export default function CreditsPage() {
  return (
    <PageShell>
      <CreditsList />
    </PageShell>
  );
}
