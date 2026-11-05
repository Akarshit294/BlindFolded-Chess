import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** Square index helpers for small demo boards (row 0 = top). */
export type MiniPiece = { at: [number, number]; p: string; className?: string };

/**
 * A small static board for the home page demos. Server-rendered markup only; pieces are the gloss sprites
 * (CSS backgrounds), so nothing here needs JavaScript.
 */
export function MiniBoard({
  size = 4,
  pieces = [],
  coords = false,
  files = "abcdefgh",
  rankTop = 8,
  className,
  mark,
  children,
  label,
}: {
  size?: number;
  pieces?: MiniPiece[];
  coords?: boolean;
  files?: string;
  rankTop?: number;
  className?: string;
  /** Extra class per cell, keyed "row,col". */
  mark?: Record<string, string>;
  children?: ReactNode;
  label?: string;
}) {
  const cells = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const dark = (r + c) % 2 === 1;
      const piece = pieces.find((p) => p.at[0] === r && p.at[1] === c);
      cells.push(
        <div key={`${r},${c}`} className={cn("mb-sq", mark?.[`${r},${c}`])} style={{ background: dark ? "var(--sq-dark)" : "var(--sq-light)" }}>
          {coords ? (
            <span className={"mb-coord"} style={{ color: dark ? "var(--sq-coord-dark)" : "var(--sq-coord-light)" }}>
              {files[c]}
              {rankTop - r}
            </span>
          ) : null}
          {piece ? <span className={cn("piece-sprite", "mb-piece", piece.className)} data-p={piece.p} /> : null}
        </div>,
      );
    }
  }
  return (
    <div
      className={cn("mb-mini", className)}
      style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {cells}
      {children}
    </div>
  );
}
