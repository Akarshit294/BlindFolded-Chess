/**
 * Defines every piece once as an SVG <symbol>; pieces on the board reference them with <use>.
 * Cheap to render many times (drag ghosts, shatter fragments, promotion picker).
 */
import { CBURNETT } from "./pieces/cburnett";
import { LUMEN, LUMEN_DEFS } from "./pieces/lumen";

const SETS: Record<string, Record<string, string>> = { lumen: LUMEN, cburnett: CBURNETT };

function buildSprite(): string {
  let out = `<defs>${LUMEN_DEFS}</defs>`;
  for (const [set, pieces] of Object.entries(SETS)) {
    for (const [key, markup] of Object.entries(pieces)) {
      out += `<symbol id="pc-${set}-${key}" viewBox="0 0 45 45">${markup}</symbol>`;
    }
  }
  return out;
}

const SPRITE = buildSprite();

export function PieceSprite() {
  return (
    <svg
      aria-hidden="true"
      width="0"
      height="0"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
      dangerouslySetInnerHTML={{ __html: SPRITE }}
    />
  );
}
