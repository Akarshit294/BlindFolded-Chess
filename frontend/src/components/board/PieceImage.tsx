"use client";
import type { Color, PieceSymbol } from "chess.js";
import { useSettings, type PieceSetId } from "@/lib/settings/store";
import { cn } from "@/lib/utils/cn";
import { PieceGlyph } from "./PieceGlyph";

type Props = {
  color: Color;
  type: PieceSymbol;
  /** Defaults to the user's piece set. */
  set?: PieceSetId;
  className?: string;
  /** Accessible name; without it the image is decorative. */
  label?: string;
};

/**
 * One piece in the chosen set. "Gloss" uses the pre-rendered 3D sprites (a CSS background chosen by theme, so
 * only the sprites in use load); Lumen and Classic are inline SVG.
 */
export function PieceImage({ color, type, set: setProp, className, label }: Props) {
  const pref = useSettings((s) => s.pieceSet);
  const set = setProp ?? pref;
  if (set === "gloss") {
    return (
      <span
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        className={cn("piece-sprite", className)}
        data-p={`${color}${type.toUpperCase()}`}
      />
    );
  }
  return <PieceGlyph set={set} color={color} type={type} className={className} title={label} />;
}

/** The silhouette-mode token: a glossy gray pebble (or a flat disc for the SVG sets). */
export function TokenImage({ className, set: setProp }: { className?: string; set?: PieceSetId }) {
  const pref = useSettings((s) => s.pieceSet);
  const set = setProp ?? pref;
  if (set === "gloss") return <span aria-hidden="true" className={cn("piece-sprite", className)} data-p="token" />;
  return (
    <span aria-hidden="true" className={cn("flex items-center justify-center", className)}>
      <span className="h-[46%] w-[46%] rounded-full bg-[radial-gradient(circle_at_35%_30%,#f2f2f2,#8a8a8a_62%,#4a4a4a)] shadow-[0_2px_6px_rgb(0_0_0/0.35)]" />
    </span>
  );
}
