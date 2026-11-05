/** Third-party software and assets. Mirrors CREDITS.md at the repository root. */
export type Credit = { name: string; what: string; license: string; url: string; author?: string };

export const ASSET_CREDITS: Credit[] = [
  { name: "Stockfish", what: "Chess engine (compiled to WebAssembly)", license: "GPL-3.0", url: "https://stockfishchess.org", author: "The Stockfish developers" },
  { name: "stockfish.js", what: "WASM build of Stockfish 19 (lite, single-threaded), incl. the lite NNUE network by Chris Bao (sscg13)", license: "GPL-3.0", url: "https://github.com/nmrugg/stockfish.js", author: "Nathan Rugg / Chess.com" },
  { name: "Lichess puzzle database", what: "Puzzles, filtered to a blindfold-friendly set", license: "CC0 1.0", url: "https://database.lichess.org/#puzzles", author: "lichess.org" },
  { name: "cburnett pieces", what: "The “Classic” piece set", license: "GFDL / BSD / GPL; CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces", author: "Colin M.L. Burnett" },
  { name: "Barlow and Barlow Semi Condensed", what: "Typefaces (text and display), self-hosted", license: "OFL-1.1", url: "https://github.com/jpt/barlow", author: "Jeremy Tribby" },
];

export const SOFTWARE_CREDITS: Credit[] = [
  { name: "Next.js", what: "React framework", license: "MIT", url: "https://nextjs.org" },
  { name: "React", what: "UI library", license: "MIT", url: "https://react.dev" },
  { name: "Motion", what: "Animation (springs, layout, gestures)", license: "MIT", url: "https://motion.dev" },
  { name: "three.js", what: "3D rendering of the pieces and the melting board", license: "MIT", url: "https://threejs.org" },
  { name: "React Three Fiber, drei", what: "React renderer and helpers for three.js (live hero, render lab)", license: "MIT", url: "https://r3f.docs.pmnd.rs" },
  { name: "postprocessing, @react-three/postprocessing", what: "Depth of field for the out-of-focus backdrop pieces", license: "Zlib / MIT", url: "https://github.com/pmndrs/postprocessing" },
  { name: "Tailwind CSS", what: "Styling", license: "MIT", url: "https://tailwindcss.com" },
  { name: "chess.js", what: "Move generation and rules (frontend)", license: "BSD-2-Clause", url: "https://github.com/jhlywa/chess.js" },
  { name: "Zustand", what: "State management", license: "MIT", url: "https://github.com/pmndrs/zustand" },
  { name: "idb", what: "IndexedDB wrapper", license: "ISC", url: "https://github.com/jakearchibald/idb" },
  { name: "Fontsource", what: "Where the Barlow font files were taken from", license: "MIT (packages) / OFL-1.1 (fonts)", url: "https://fontsource.org" },
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
