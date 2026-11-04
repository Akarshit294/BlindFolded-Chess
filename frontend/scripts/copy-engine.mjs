// Copies the single-threaded "lite" Stockfish WASM build from node_modules into
// public/engine so it can be served statically and loaded lazily in a Web Worker.
// Runs automatically before `next dev` and `next build`.
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "public", "engine");

let pkgDir;
try {
  pkgDir = dirname(require.resolve("stockfish/package.json"));
} catch {
  console.error("[copy-engine] The 'stockfish' package is not installed. Run `npm install` first.");
  process.exit(1);
}

const { version } = require("stockfish/package.json");
const major = version.split(".")[0];
const files = [
  [`stockfish-${major}-lite-single.js`, "stockfish.js"],
  [`stockfish-${major}-lite-single.wasm`, "stockfish.wasm"],
];

mkdirSync(outDir, { recursive: true });
for (const [from, to] of files) {
  const src = join(pkgDir, "bin", from);
  const dest = join(outDir, to);
  if (!existsSync(src)) {
    console.error(`[copy-engine] Missing ${src}`);
    process.exit(1);
  }
  if (existsSync(dest) && statSync(dest).size === statSync(src).size) continue;
  copyFileSync(src, dest);
  console.log(`[copy-engine] ${from} -> public/engine/${to}`);
}
