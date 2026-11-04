/** Third-party software and assets. Mirrors CREDITS.md at the repository root. */
export type Credit = { name: string; what: string; license: string; url: string; author?: string };

export const ASSET_CREDITS: Credit[] = [
  { name: "Stockfish", what: "Chess engine (compiled to WebAssembly)", license: "GPL-3.0", url: "https://stockfishchess.org", author: "The Stockfish developers" },
  { name: "stockfish.js", what: "WASM build of Stockfish 19 (lite, single-threaded), incl. the lite NNUE network by Chris Bao (sscg13)", license: "GPL-3.0", url: "https://github.com/nmrugg/stockfish.js", author: "Nathan Rugg / Chess.com" },
  { name: "Lichess puzzle database", what: "Puzzles, filtered to a blindfold-friendly set", license: "CC0 1.0", url: "https://database.lichess.org/#puzzles", author: "lichess.org" },
  { name: "cburnett pieces", what: "The “Classic” piece set", license: "GFDL / BSD / GPL; CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces", author: "Colin M.L. Burnett" },
  { name: "Inter", what: "Interface typeface", license: "OFL-1.1", url: "https://rsms.me/inter/", author: "Rasmus Andersson" },
  { name: "Fraunces", what: "Display typeface", license: "OFL-1.1", url: "https://github.com/undercasetype/Fraunces", author: "Undercase Type" },
  { name: "JetBrains Mono", what: "Monospace typeface for notation", license: "OFL-1.1", url: "https://www.jetbrains.com/lp/mono/", author: "JetBrains" },
  { name: "The Opera Game", what: "Morphy vs. Duke Karl & Count Isouard, Paris 1858 (landing page)", license: "Public domain", url: "https://en.wikipedia.org/wiki/Opera_Game" },
];

export const SOFTWARE_CREDITS: Credit[] = [
  { name: "Next.js", what: "React framework", license: "MIT", url: "https://nextjs.org" },
  { name: "React", what: "UI library", license: "MIT", url: "https://react.dev" },
  { name: "Motion", what: "Animation (springs, layout, gestures)", license: "MIT", url: "https://motion.dev" },
  { name: "Tailwind CSS", what: "Styling", license: "MIT", url: "https://tailwindcss.com" },
  { name: "chess.js", what: "Move generation and rules (frontend)", license: "BSD-2-Clause", url: "https://github.com/jhlywa/chess.js" },
  { name: "Zustand", what: "State management", license: "MIT", url: "https://github.com/pmndrs/zustand" },
  { name: "idb", what: "IndexedDB wrapper", license: "ISC", url: "https://github.com/jakearchibald/idb" },
  { name: "Fontsource", what: "Self-hosted font packages", license: "MIT (packages) / OFL-1.1 (fonts)", url: "https://fontsource.org" },
  { name: "FastAPI", what: "Backend web framework", license: "MIT", url: "https://fastapi.tiangolo.com" },
  { name: "Starlette", what: "ASGI toolkit under FastAPI", license: "BSD-3-Clause", url: "https://www.starlette.io" },
  { name: "Uvicorn", what: "ASGI server", license: "BSD-3-Clause", url: "https://www.uvicorn.org" },
  { name: "Pydantic", what: "Validation", license: "MIT", url: "https://docs.pydantic.dev" },
  { name: "python-chess (chess)", what: "Rules, PGN and engine communication (backend)", license: "GPL-3.0-or-later", url: "https://github.com/niklasf/python-chess" },
  { name: "zstandard", what: "Reading the compressed puzzle database (pipeline only)", license: "BSD-3-Clause", url: "https://github.com/indygreg/python-zstandard" },
  { name: "Vitest, Playwright, Testing Library, fake-indexeddb, jsdom", what: "Testing", license: "MIT / Apache-2.0", url: "https://vitest.dev" },
  { name: "pytest, Ruff, mypy, uv", what: "Backend tooling", license: "MIT / Apache-2.0", url: "https://docs.astral.sh/uv/" },
  { name: "TypeScript, ESLint", what: "Language and linting", license: "Apache-2.0 / MIT", url: "https://www.typescriptlang.org" },
];
