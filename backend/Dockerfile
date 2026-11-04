# Blindfold Chess API: FastAPI + python-chess + Stockfish (Debian package).
# Runs on Render (injects PORT) and Hugging Face Docker Spaces (port 7860, uid 1000).
#
#   docker build -t blindfold-chess-api backend
#   docker run --rm -p 7860:7860 blindfold-chess-api

FROM ghcr.io/astral-sh/uv:0.11.32 AS uv

FROM python:3.12-slim

# Stockfish lands in /usr/games/stockfish.
RUN apt-get update \
    && apt-get install --yes --no-install-recommends stockfish \
    && rm -rf /var/lib/apt/lists/*

COPY --from=uv /uv /uvx /usr/local/bin/

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_NO_CACHE=1 \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:${PATH}" \
    STOCKFISH_PATH=/usr/games/stockfish

# Hugging Face Spaces run containers as uid 1000.
RUN useradd --create-home --uid 1000 user

WORKDIR /home/user/app

# Dependencies first (cached layer), then the application code.
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen --no-dev --no-install-project

COPY app ./app

USER user

EXPOSE 7860

CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860} --proxy-headers --forwarded-allow-ips='*'"]
