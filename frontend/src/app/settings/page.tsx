import type { Metadata } from "next";
import { PageShell } from "@/components/layout/PageShell";
import { SettingsPanel } from "@/components/settings/SettingsPanel";

export const metadata: Metadata = { title: "Settings", description: "Board theme, pieces, sound, voice, motion and blindfold options." };

export default function SettingsPage() {
  return (
    <PageShell>
      <SettingsPanel />
    </PageShell>
  );
}
