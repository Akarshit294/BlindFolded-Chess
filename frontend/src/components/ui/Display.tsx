import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

const SIZES = {
  xl: "text-display-xl",
  lg: "text-display-lg",
  md: "text-display-md",
} as const;

/**
 * The signature headline: one uppercase line mixing a thin gray word and a bold black word. The DOM keeps
 * sentence case (uppercase is CSS), so screen readers and tests read natural words.
 */
export function DisplayTitle({
  thin,
  bold,
  as: As = "h1",
  size = "lg",
  stack = false,
  className,
  id,
}: {
  thin?: ReactNode;
  bold: ReactNode;
  as?: "h1" | "h2" | "h3" | "p";
  size?: keyof typeof SIZES;
  /** Put the two words on separate lines. */
  stack?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <As id={id} className={cn("display", SIZES[size], className)}>
      {thin ? (
        <>
          <span className={cn("thin", stack && "block")}>{thin}</span>
          {stack ? null : " "}
        </>
      ) : null}
      <span className={stack ? "block" : undefined}>{bold}</span>
    </As>
  );
}

/** The short black rule under a main headline (from the reference). */
export function Rule({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("display-rule", className)} />;
}

/** Page header: display title, rule, a short gray lead, optional actions on the right. */
export function PageHeader({
  thin,
  bold,
  lead,
  actions,
  className,
  children,
}: {
  thin?: ReactNode;
  bold: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-10 gap-y-6", className)}>
      <div className="rise-in max-w-2xl">
        <DisplayTitle thin={thin} bold={bold} size="lg" />
        <Rule className="mt-5" />
        {lead ? <p className="mt-5 max-w-xl text-body text-fg sm:text-lead">{lead}</p> : null}
        {children}
      </div>
      {actions ? <div className="rise-in rise-in-1 flex flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}

/** Section heading inside a page: bold display line, optional thin lead-in word. */
export function SectionTitle({ thin, bold, id, className }: { thin?: ReactNode; bold: ReactNode; id?: string; className?: string }) {
  return <DisplayTitle as="h2" size="md" thin={thin} bold={bold} id={id} className={className} />;
}
