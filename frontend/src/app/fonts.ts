/**
 * Self-hosted Barlow (SIL OFL 1.1, see src/fonts/OFL-Barlow.txt). next/font/local preloads the files and
 * generates a metric-matched fallback, so text never jumps when the real font arrives.
 *
 * Text: Barlow 400 / 600. Display (uppercase titles): Barlow Semi Condensed 300 (thin) / 700 (bold).
 */
import localFont from "next/font/local";

export const textFont = localFont({
  src: [
    { path: "../fonts/barlow-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/barlow-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--ff-text",
  display: "swap",
  adjustFontFallback: "Arial",
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "sans-serif"],
});

export const displayFont = localFont({
  src: [
    { path: "../fonts/barlow-semi-condensed-latin-300-normal.woff2", weight: "300", style: "normal" },
    { path: "../fonts/barlow-semi-condensed-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--ff-display",
  display: "swap",
  adjustFontFallback: "Arial",
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial Narrow", "Arial", "sans-serif"],
});
