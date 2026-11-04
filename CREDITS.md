# Credits and third-party licences

Blindfold Chess is licensed under the **GNU General Public License v3.0 or later** (see `LICENSE`),
because it distributes the Stockfish engine. Everything it builds on is listed below.

## Engine, data and artwork

| What | Used for | Licence | Source |
|---|---|---|---|
| **Stockfish** (the Stockfish developers) | Chess engine | GPL-3.0 | https://stockfishchess.org |
| **stockfish.js 19.0.1** (Nathan Rugg / Chess.com) | WebAssembly build of Stockfish 19, *lite single-threaded* flavour, served from `frontend/public/engine/` (copied from npm at build time). Includes the lite NNUE network by Chris Bao (sscg13). | GPL-3.0 | https://github.com/nmrugg/stockfish.js |
| **Stockfish (Debian package)** | Native engine inside the backend Docker image (`apt install stockfish`) | GPL-3.0 | https://packages.debian.org/stockfish |
| **Lichess puzzle database** | Source of the 4,000 backend puzzles and the 1,200 bundled puzzles (filtered and re-encoded by `backend/scripts/build_puzzles.py`) | CC0 1.0 | https://database.lichess.org/#puzzles |
| **"cburnett" chess pieces** by Colin M.L. Burnett | The "Classic" piece set (`frontend/src/components/board/pieces/cburnett.ts`), taken from the lichess-org/lila repository | GFDL / BSD / GPL (tri-licensed on Wikimedia Commons), also distributed as CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces |
| **Inter** (Rasmus Andersson) | Interface typeface, via `@fontsource-variable/inter` | OFL-1.1 | https://rsms.me/inter/ |
| **Fraunces** (Undercase Type) | Display typeface, via `@fontsource-variable/fraunces` | OFL-1.1 | https://github.com/undercasetype/Fraunces |
| **JetBrains Mono** (JetBrains) | Monospace notation font, via `@fontsource-variable/jetbrains-mono` | OFL-1.1 | https://www.jetbrains.com/lp/mono/ |
| **The Opera Game** (Morphy vs. Duke Karl & Count Isouard, Paris 1858) | Landing-page animation | Public domain | — |

Made for this project (GPL-3.0 like the rest of the code): the **"Lumen"** piece set, all icons,
the "eye ↔ closed eye" brand mark, all sounds (synthesised live with the Web Audio API — there
are no audio files), the visual design, and every text on the site.

## Frontend software (npm)

| Package | Version | Licence |
|---|---|---|
| next | 16.4.5 | MIT |
| react, react-dom | 19.3.0 | MIT |
| motion (framer-motion, motion-dom) | 14.9.1 | MIT |
| chess.js | 1.4.0 | BSD-2-Clause |
| zustand | 5.0.16 | MIT |
| idb | 8.0.4 | ISC |
| stockfish | 19.0.1 | GPL-3.0 |
| @fontsource-variable/inter, /fraunces, /jetbrains-mono | 5.3.0 | OFL-1.1 (fonts), MIT (packaging) |
| tailwindcss, @tailwindcss/turbopack | 4.3.4 | MIT |
| typescript (dev) | 6.0.3 | Apache-2.0 |
| eslint, eslint-config-next (dev) | 9.39.5, 16.4.5 | MIT |
| vitest (dev) | 5.1.0 | MIT |
| @playwright/test (dev) | 1.64.1 | Apache-2.0 |
| jsdom, @testing-library/react, @testing-library/dom (dev) | 30.1.3, 16.3.3, 10.4.2 | MIT |
| fake-indexeddb (dev) | 6.2.7 | Apache-2.0 |

## Backend software (PyPI, managed with uv)

| Package | Version | Licence |
|---|---|---|
| fastapi | 0.162.0 | MIT |
| starlette | 1.10.0 | BSD-3-Clause |
| uvicorn[standard] | 0.54.0 | BSD-3-Clause |
| pydantic | 2.14.2 | MIT |
| chess (python-chess) | 1.11.2 | GPL-3.0-or-later |
| zstandard (dev, pipeline only) | 0.25.0 | BSD-3-Clause |
| pytest, httpx2, ruff, mypy (dev) | see `backend/uv.lock` | MIT / BSD / Apache-2.0 |

Exact versions of every transitive dependency are pinned in `frontend/package-lock.json` and
`backend/uv.lock`.

## Thanks

To the Stockfish team, to Nathan Rugg for keeping a browser build of Stockfish alive, to the
Lichess project for releasing its puzzle database into the public domain, and to everyone who has
ever played a game of chess with their eyes closed and written about it.
