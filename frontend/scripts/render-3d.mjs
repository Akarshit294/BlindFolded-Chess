#!/usr/bin/env node
/**
 * Renders the site's 3D artwork from the procedural models in src/three/ into WebP files under public/3d/:
 *
 *   public/3d/pieces/{light,dark}/{wK…bP,token}.webp   board sprites (porcelain, lacquer, silhouette token)
 *   public/3d/hero/{light,dark}-{solid,melted}-{1440,720}.webp   home hero frames (static fallback)
 *   public/3d/backdrop/{name}-{light,dark}.webp          out-of-focus pieces for the studio backdrop
 *
 * Needs the dev server (the lab page is development-only):
 *   npm run dev -- --port 3300 &
 *   node scripts/render-3d.mjs --base http://127.0.0.1:3300 [--only sprites,hero,backdrop]
 *
 * Runs headless Chrome with SwiftShader, so it works without a GPU (slowly). The outputs are committed, so a
 * normal build never needs this script.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, "../public/3d");
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .join(" ")
    .split("--")
    .filter(Boolean)
    .map((s) => {
      const [k, ...v] = s.trim().split(/\s+/);
      return [k, v.join(" ") || "1"];
    }),
);
const BASE = args.base ?? "http://127.0.0.1:3300";
const ONLY = new Set((args.only ?? "sprites,hero,backdrop").split(","));
const PIECES = args.pieces ? args.pieces.split(",") : ["wK", "wQ", "wR", "wB", "wN", "wP", "bK", "bQ", "bR", "bB", "bN", "bP", "token"];
const THEMES = (args.themes ?? "light,dark").split(",");

const jobs = [];
if (ONLY.has("sprites")) {
  for (const theme of THEMES)
    for (const piece of PIECES) jobs.push({ out: `pieces/${theme}/${piece}.webp`, spec: { kind: "sprite", piece, theme, size: 256 } });
}
if (ONLY.has("hero")) {
  for (const theme of THEMES)
    for (const frame of ["solid", "melted"])
      for (const [w, h] of [
        [1440, 1080],
        [720, 540],
      ])
        jobs.push({ out: `hero/${theme}-${frame}-${w}.webp`, spec: { kind: "hero", theme, frame, width: w, height: h } });
}
if (ONLY.has("backdrop")) {
  const BD = [
    ["pawn-w", "wP", 0.15, 0.4],
    ["pawn-w2", "wP", -0.2, 1.4],
    ["bishop-b", "bB", 0.1, -0.5],
    ["pawn-b", "bP", -0.1, 0.8],
    ["knight-b", "bN", 0.05, 0.6],
  ];
  for (const theme of THEMES)
    for (const [name, piece, tilt, turn] of BD)
      jobs.push({ out: `backdrop/${name}-${theme}.webp`, spec: { kind: "backdrop", piece, theme, size: 320, blur: Number(args.blur ?? 26), tilt, turn, dof: args.dof !== "0" } });
}

const executablePath = process.env.PW_CHROMIUM_PATH || process.env.CHROME_PATH || undefined;
const browser = await chromium.launch({
  executablePath,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"],
});
const page = await browser.newPage({ viewport: { width: 3000, height: 2200 }, deviceScaleFactor: 1 });
page.on("console", (m) => {
  if (m.type() === "error") console.error("  [page]", m.text().slice(0, 300));
});
await page.goto(`${BASE}/lab/render`, { waitUntil: "networkidle", timeout: 120_000 });
await page.waitForFunction(() => window.__bfRenderReady === true, null, { timeout: 120_000 });

for (const job of jobs) {
  const t0 = Date.now();
  let url;
  if (job.spec.kind === "backdrop" && job.spec.dof) {
    // Depth of field renders opaque: render over black and over white, then pull the alpha out.
    const black = await page.evaluate((spec) => window.__bfRender({ ...spec, matte: "black" }), job.spec);
    const white = await page.evaluate((spec) => window.__bfRender({ ...spec, matte: "white" }), job.spec);
    url = await page.evaluate(([b, w]) => window.__bfMatte(b, w), [black, white]);
  } else {
    url = await page.evaluate((spec) => window.__bfRender(spec), job.spec);
  }
  const file = path.join(OUT, job.out);
  await mkdir(path.dirname(file), { recursive: true });
  const buf = Buffer.from(url.split(",")[1], "base64");
  await writeFile(file, buf);
  console.log(`✓ ${job.out}  ${(buf.length / 1024).toFixed(1)} KB  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
await browser.close();
