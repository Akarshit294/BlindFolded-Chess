# Deploying Blindfold Chess for $0

The site is two independent pieces:

| Piece | Where | Cost | Needed? |
|---|---|---|---|
| **Frontend** (Next.js, `frontend/`) | Vercel Hobby | free | yes |
| **Backend** (FastAPI, `backend/`) | Render free web service **or** Hugging Face Docker Space | free | optional |

The frontend works on its own: Stockfish runs in the browser, drills are generated locally, and
1,200 puzzles ship with the site. The backend adds the full 4,000-puzzle set, seeded drill data and
faster native-Stockfish game analysis. If the backend is asleep or unreachable, the site silently
falls back and the footer pill says "Offline mode".

No accounts are needed by your users, and nothing here needs a credit card or API key.

---

## 1. Backend on Render (free plan)

The repository contains a Render Blueprint: [`render.yaml`](render.yaml) (one Docker web service,
`rootDir: backend`, health check `/api/health`).

1. Push this repository to GitHub.
2. In the Render dashboard choose **New → Blueprint**, connect the repository and pick the branch.
3. Render reads `render.yaml` and proposes the service **blindfold-chess-api** on the **Free** plan.
   Click **Apply**. The first build installs Stockfish from Debian and takes a few minutes.
4. When it is live, open `https://<your-service>.onrender.com/api/health`. You should see
   `{"status":"ok", ... "engine": true, "puzzles": 4000}`.
5. After the frontend is deployed (step 3 below), set the service's `CORS_ORIGINS` environment
   variable to your Vercel URL, e.g. `https://blindfold-chess.vercel.app` (comma-separate several).
   The default `*` also works, since the API uses no cookies or credentials.

Free Render services sleep after ~15 minutes without traffic and take 30–60 s to wake up. The
frontend pings `/api/health` on load (which wakes it) and uses its offline fallbacks meanwhile.

### Alternative: Hugging Face Spaces (Docker)

1. Create a new Space with the **Docker** SDK (blank template).
2. Copy the contents of `backend/` to the root of the Space repository and push.
3. Put this front matter at the top of the Space's `README.md`:

   ```yaml
   ---
   title: Blindfold Chess API
   sdk: docker
   app_port: 7860
   license: gpl-3.0
   ---
   ```

4. Optionally add `CORS_ORIGINS` under **Settings → Variables and secrets**.
5. The API is served at `https://<user>-<space>.hf.space/api/health`.

The Docker image listens on `$PORT` (Render injects it) or 7860 (Hugging Face), runs as uid 1000
and contains everything it needs, including the Stockfish binary.

---

## 2. Frontend on Vercel (Hobby)

1. In Vercel choose **Add New → Project** and import the repository.
2. Set **Root Directory** to `frontend`. The framework preset is detected as **Next.js**; keep the
   default build command (`npm run build`) and output settings.
3. Add the environment variable **`NEXT_PUBLIC_API_URL`** = your backend URL **without** a trailing
   slash, e.g. `https://blindfold-chess-api.onrender.com`.
   Leave it unset to deploy in permanent offline mode (no backend at all).
4. Click **Deploy**.

Notes:

- `NEXT_PUBLIC_API_URL` is inlined at build time — redeploy after changing it.
- No special headers are required. The engine is the single-threaded Stockfish build, which does
  not need `SharedArrayBuffer` or cross-origin isolation (COOP/COEP).
- The engine files (`/engine/stockfish.js` + `.wasm`, ~1.9 MB) are copied from `node_modules`
  during `prebuild` and cached by the browser; they are loaded only on pages that use the engine.
- Every route is prerendered as static HTML, so the Hobby plan's limits are not a concern.

---

## 3. Check that it works

- Open the site and look at the footer: **Server online** means the frontend reached the API.
- **Puzzles**: the "Offline set" badge disappears when puzzles come from the API.
- **Play** a game and resign: the review shows "Analysed on the server" when the backend analysed it.

## 4. Running it yourself (no cloud at all)

```bash
make dev            # http://localhost:3000 (web) + http://localhost:8000 (API)
docker compose up   # same, in containers
```

## 5. Updating the puzzle set

```bash
make puzzles        # downloads the Lichess puzzle DB (CC0, ~300 MB) and rebuilds both JSON files
```

Commit `backend/app/data/puzzles.json` and `frontend/public/data/puzzles.json`, then redeploy both.

## Licence reminder

The project is GPL-3.0 because it ships Stockfish. If you deploy a modified version, the GPL asks
you to make your source available to your users — keeping your fork public on GitHub does that.
