/**
 * "Lumen" — an original piece set drawn for this project (GPL-3.0, like the rest of the repo).
 * Geometric silhouettes with soft gradients; viewBox 0 0 45 45 to match the classic set.
 * Gradients are referenced by id and defined once in <PieceSprite>.
 */

const W = { fill: "url(#lumen-w)", stroke: "#141823", detail: "#141823", detailOpacity: "0.55" };
const B = { fill: "url(#lumen-b)", stroke: "#06080d", detail: "#e8e1d1", detailOpacity: "0.75" };
type Palette = typeof W;

const base = (p: Palette, x0 = 10.5, x1 = 34.5) =>
  `<path d="M${x0 + 1.5} 34h${x1 - x0 - 3}a2 2 0 0 1 2 2v1.2a1.8 1.8 0 0 1-1.8 1.8H${x0 + 1.3}a1.8 1.8 0 0 1-1.8-1.8V36a2 2 0 0 1 2-2z" fill="${p.fill}" stroke="${p.stroke}"/>`;

function pawn(p: Palette): string {
  return [
    `<g stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" transform="translate(22.5 39) scale(1.08) translate(-22.5 -39.2)">`,
    `<path d="M17.4 34c.4-4.6 2.3-8.2 3.4-10.9h3.4c1.1 2.7 3 6.3 3.4 10.9z" fill="${p.fill}" stroke="${p.stroke}"/>`,
    `<path d="M18.2 20.2h8.6a1.6 1.6 0 0 1 0 3.2h-8.6a1.6 1.6 0 0 1 0-3.2z" fill="${p.fill}" stroke="${p.stroke}"/>`,
    `<circle cx="22.5" cy="14.6" r="5.2" fill="${p.fill}" stroke="${p.stroke}"/>`,
    base(p, 13, 32),
    `<path d="M20.4 12.6a2.8 2.8 0 0 1 2.4-1.4" fill="none" stroke="${p.detail}" stroke-opacity="${p.detailOpacity}" stroke-width="1"/>`,
    `</g>`,
  ].join("");
}

function rook(p: Palette): string {
  return [
    `<g stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" transform="translate(22.5 39) scale(1.08) translate(-22.5 -39.2)">`,
    `<path d="M14.5 34l2-4.2V17.5h12v12.3l2 4.2z" fill="${p.fill}" stroke="${p.stroke}"/>`,
    `<path d="M12.8 9.2h3.9v3.1h3.6V9.2h4.4v3.1h3.6V9.2h3.9v5.6l-3.2 2.9H16l-3.2-2.9z" fill="${p.fill}" stroke="${p.stroke}"/>`,
    base(p),
    `<path d="M16.5 20.5h12M16.5 29.5h12" fill="none" stroke="${p.detail}" stroke-opacity="${p.detailOpacity}" stroke-width="1"/>`,
    `</g>`,
  ].join("");
}

function bishop(p: Palette): string {
  return [
    `<g stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" transform="translate(22.5 39) scale(1.08) translate(-22.5 -39.2)">`,
    `<path d="M18.2 31.5c-.2 1.3-1.4 2.2-3.2 2.5h15c-1.8-.3-3-1.2-3.2-2.5z" fill="${p.fill}" stroke="${p.stroke}"/>`,
    `<path d="M16.9 27.6h11.2a1.9 1.9 0 0 1 0 3.8H16.9a1.9 1.9 0 0 1 0-3.8z" fill="${p.fill}" stroke="${p.stroke}"/>`,
    `<path d="M22.5 9.8c-5.6 3.9-7.6 9.2-6.1 13.6 1 2.9 3.3 4.2 6.1 4.2s5.1-1.3 6.1-4.2c1.5-4.4-.5-9.7-6.1-13.6z" fill="${p.fill}" stroke="${p.stroke}"/>`,
    `<circle cx="22.5" cy="7.4" r="2.1" fill="${p.fill}" stroke="${p.stroke}"/>`,
    `<path d="M20.4 20.6l5-5.2" fill="none" stroke="${p.detail}" stroke-opacity="${p.detailOpacity === "0.55" ? "0.85" : "0.95"}" stroke-width="1.6"/>`,
    base(p),
    `</g>`,
  ].join("");
}

function knight(p: Palette): string {
  return [
    `<g stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" transform="translate(22.5 39) scale(1.08) translate(-22.5 -39.2)">`,
    `<path d="M14.2 34c.6-3.4 2.4-6.2 4.9-8.6-2.1.9-4.2 1.1-5.8.4-1.8-.8-2.6-2.8-1.9-4.6 1.2-3.1 3.6-5.6 6.4-7.4l2.2-4.3 1.6 2.9c1.5-.4 3-.5 4.5-.3l2.7-3.3.6 4.5c3.2 1.9 5.2 5.6 5.5 10.4.2 3.3-.2 6.6-1 10.3z" fill="${p.fill}" stroke="${p.stroke}"/>`,
    `<circle cx="20" cy="17.6" r="1.15" fill="${p.detail}" fill-opacity="${p.detailOpacity === "0.55" ? "0.9" : "0.95"}" stroke="none"/>`,
    `<path d="M13.6 22.9c.5-.2 1-.2 1.4.1" fill="none" stroke="${p.detail}" stroke-opacity="${p.detailOpacity}" stroke-width="1"/>`,
    `<path d="M28.7 15.6c1.6 2.3 2.4 5.3 2.3 8.9M27.3 20.2c.9 1.6 1.3 3.6 1.2 5.9" fill="none" stroke="${p.detail}" stroke-opacity="${p.detailOpacity}" stroke-width="1"/>`,
    base(p),
    `</g>`,
  ].join("");
}

function queen(p: Palette): string {
  return [
    `<g stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" transform="translate(22.5 39) scale(1.08) translate(-22.5 -39.2)">`,
    `<path d="M15 34c.3-1.9 1.3-3.6 1.2-6.1h12.6c-.1 2.5.9 4.2 1.2 6.1z" fill="${p.fill}" stroke="${p.stroke}"/>`,
    `<path d="M10.6 13.4l4.7 14.5h14.4l4.7-14.5-6.3 7.7-1.6-10.3-4 9.4-4-9.4-1.6 10.3z" fill="${p.fill}" stroke="${p.stroke}"/>`,
    `<circle cx="10.4" cy="12.2" r="1.9" fill="${p.fill}" stroke="${p.stroke}"/>`,
    `<circle cx="16.5" cy="9.4" r="1.9" fill="${p.fill}" stroke="${p.stroke}"/>`,
    `<circle cx="22.5" cy="8.2" r="2" fill="${p.fill}" stroke="${p.stroke}"/>`,
    `<circle cx="28.5" cy="9.4" r="1.9" fill="${p.fill}" stroke="${p.stroke}"/>`,
    `<circle cx="34.6" cy="12.2" r="1.9" fill="${p.fill}" stroke="${p.stroke}"/>`,
    `<path d="M16.3 24.6h12.4" fill="none" stroke="${p.detail}" stroke-opacity="${p.detailOpacity}" stroke-width="1"/>`,
    base(p),
    `</g>`,
  ].join("");
}

function king(p: Palette): string {
  return [
    `<g stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" transform="translate(22.5 39) scale(1.08) translate(-22.5 -39.2)">`,
    `<path d="M15 34c.3-1.9 1.3-3.6 1.2-6.1h12.6c-.1 2.5.9 4.2 1.2 6.1z" fill="${p.fill}" stroke="${p.stroke}"/>`,
    `<path d="M22.5 15.2c-2.1-2.6-6.6-3.6-9.3-1.4-3.2 2.6-2.1 8.4 2.9 14.1h12.8c5-5.7 6.1-11.5 2.9-14.1-2.7-2.2-7.2-1.2-9.3 1.4z" fill="${p.fill}" stroke="${p.stroke}"/>`,
    `<path d="M21.3 3.9h2.4v2.7h2.7V9h-2.7v4.6h-2.4V9h-2.7V6.6h2.7z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.2"/>`,
    `<path d="M22.5 15.4v7.6M16.4 24.2h12.2" fill="none" stroke="${p.detail}" stroke-opacity="${p.detailOpacity}" stroke-width="1"/>`,
    base(p),
    `</g>`,
  ].join("");
}

export const LUMEN: Record<string, string> = {
  wK: king(W),
  wQ: queen(W),
  wR: rook(W),
  wB: bishop(W),
  wN: knight(W),
  wP: pawn(W),
  bK: king(B),
  bQ: queen(B),
  bR: rook(B),
  bB: bishop(B),
  bN: knight(B),
  bP: pawn(B),
};

/** Gradient definitions used by the Lumen pieces. */
export const LUMEN_DEFS = `
<radialGradient id="lumen-w" cx="35%" cy="25%" r="85%">
  <stop offset="0" stop-color="#fffdf7"/>
  <stop offset="0.6" stop-color="#f1eadb"/>
  <stop offset="1" stop-color="#d9cfbb"/>
</radialGradient>
<radialGradient id="lumen-b" cx="35%" cy="25%" r="85%">
  <stop offset="0" stop-color="#4a5270"/>
  <stop offset="0.55" stop-color="#2a3044"/>
  <stop offset="1" stop-color="#161a26"/>
</radialGradient>`;
