import { MiniBoard } from "@/components/home/MiniBoard";
import { cn } from "@/lib/utils/cn";

/** A small, quiet picture of what each drill asks (CSS-only animation). */
export function DrillVisual({ id }: { id: string }) {
  switch (id) {
    case "square-color":
      return (
        <div className="flex items-center gap-3" aria-hidden="true">
          <span className={cn("flex h-16 w-16 items-center justify-center rounded-xl font-display text-2xl font-bold text-ink shadow-raised", "demo-flip")}>f6</span>
          <span className="text-small font-semibold text-muted">light or dark?</span>
        </div>
      );
    case "coordinates":
      return (
        <div className="w-24">
          <MiniBoard size={4} mark={{ "1,2": "ring-2 ring-inset ring-ink" }} />
        </div>
      );
    case "knight-routes":
      return (
        <div className="relative w-24" aria-hidden="true">
          <MiniBoard size={4} pieces={[{ at: [3, 0], p: "wN" }]} />
          <svg viewBox="0 0 40 40" className="pointer-events-none absolute inset-0 h-full w-full">
            <path d="M5 35 L5 15 L15 15 L15 5 L25 5" pathLength={100} fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={"demo-draw"} />
          </svg>
        </div>
      );
    case "lines":
      return (
        <div className="relative w-24" aria-hidden="true">
          <MiniBoard size={4} />
          <svg viewBox="0 0 40 40" className="pointer-events-none absolute inset-0 h-full w-full">
            <path d="M5 35 L35 5" pathLength={100} fill="none" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" className={"demo-draw"} />
          </svg>
        </div>
      );
    case "where-piece":
      return (
        <div className="text-center" aria-hidden="true">
          <p className="text-lg font-semibold tabular text-ink">1. e4 e5 2. Nf3 Nc6</p>
          <p className="mt-2 text-small text-muted">Where is the white knight?</p>
        </div>
      );
    default:
      return (
        <div className="w-24" aria-hidden="true">
          <MiniBoard size={4} pieces={[{ at: [0, 1], p: "bK" }, { at: [2, 2], p: "wR" }, { at: [3, 0], p: "wK" }]} className={"demo-ghost"} />
        </div>
      );
  }
}
