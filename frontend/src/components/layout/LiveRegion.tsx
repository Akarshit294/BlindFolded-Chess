"use client";
import { useAnnouncer } from "@/lib/a11y/announcer";

export function LiveRegion() {
  const polite = useAnnouncer((s) => s.polite);
  const assertive = useAnnouncer((s) => s.assertive);
  return (
    <>
      <div aria-live="polite" aria-atomic="true" className="sr-only" data-testid="live-polite">
        {polite}
      </div>
      <div aria-live="assertive" aria-atomic="true" className="sr-only" data-testid="live-assertive">
        {assertive}
      </div>
    </>
  );
}
