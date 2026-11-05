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
| **Barlow** and **Barlow Semi Condensed** (Jeremy Tribby, The Barlow Project Authors) | Text typeface (Barlow 400/600) and display typeface for the uppercase titles (Semi Condensed 300/700). Latin subsets self-hosted from `frontend/src/fonts/` (files taken from the Fontsource packages); the licence travels with them as `frontend/src/fonts/OFL-Barlow.txt` | OFL-1.1 | https://github.com/jpt/barlow |

Made for this project (GPL-3.0 like the rest of the code), at no cost:

- the **"Gloss"** porcelain-and-lacquer piece set: every piece is modelled procedurally in code
  (`frontend/src/three/pieces.ts`, lathe profiles and an extruded, sculpted knight), lit with
  three.js's built-in `RoomEnvironment` and rendered to the WebP sprites in `frontend/public/3d/`
  by `frontend/scripts/render-3d.mjs`. The same script renders the melting hero boards and the
  out-of-focus backdrop pieces. No third-party models, textures, HDRIs or photos are used;
- the melting-board shaders (`frontend/src/components/board/MeltSurface.tsx` and
  `frontend/src/three/HeroBoardScene.tsx`);
- the **"Lumen"** piece set, all icons, the pawn logo mark, all sounds (synthesised live with the
  Web Audio API — there are no audio files), the visual design, and every text on the site.

`docs/design/style-reference.jpeg` is the art-direction reference that came with the redesign
brief. It is kept with the design documents only: it is not shipped with the site, and no part of
it is used in any asset.

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
| three (three.js) | 0.187.0 | MIT |
| @react-three/fiber | 9.8.2 | MIT |
| @react-three/drei (with its dependencies three-stdlib, maath, camera-controls, troika-three-text) | 10.7.9 | MIT |
| postprocessing | 6.39.6 | Zlib |
| @react-three/postprocessing | 3.2.2 | MIT |
| tailwindcss, @tailwindcss/turbopack | 4.3.4 | MIT |
| typescript, @types/three (dev) | 6.0.3, 0.187.0 | Apache-2.0, MIT |
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
Lichess project for releasing its puzzle database into the public domain, to the three.js and
Poimandres (pmndrs) communities, to Jeremy Tribby for Barlow, and to everyone who has ever played a
game of chess with their eyes closed and written about it.
