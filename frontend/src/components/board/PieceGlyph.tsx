import type { Color, PieceSymbol } from "chess.js";

type Props = {
  set: string;
  color: Color;
  type: PieceSymbol;
  className?: string;
  title?: string;
};

/** A single piece image (references the shared sprite). */
export function PieceGlyph({ set, color, type, className, title }: Props) {
  return (
    <svg viewBox="0 0 45 45" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <use href={`#pc-${set}-${color}${type.toUpperCase()}`} />
    </svg>
  );
}
