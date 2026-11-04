import { ViewTransition, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** Wraps page content so route changes cross-fade with a gentle rise (View Transitions API). */
export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ViewTransition enter="page-fade" exit="page-fade" default="none">
      <div className={cn("relative", className)}>{children}</div>
    </ViewTransition>
  );
}
