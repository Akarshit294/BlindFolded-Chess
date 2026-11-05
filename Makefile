# Blindfold Chess — one-command developer workflow.
#   make dev     install what is missing, then run the API (:8000) and the web app (:3000)
#   make test    unit tests for both apps
#   make lint    linters + type checks for both apps
#   make e2e     Playwright end-to-end tests (builds the frontend, starts both servers)
#   make build   production build of the frontend
SHELL := /bin/bash
.DEFAULT_GOAL := help

API_PORT ?= 8000
WEB_PORT ?= 3000
HAS_UV   := $(shell command -v uv 2>/dev/null)

.PHONY: help install install-frontend install-backend dev dev-frontend dev-backend \
        test test-frontend test-backend lint lint-frontend lint-backend typecheck build e2e \
        puzzles docker docker-up clean

help: ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[33m%-16s\033[0m %s\n", $$1, $$2}'

install: install-frontend install-backend ## Install all dependencies

install-frontend: frontend/node_modules/.installed
frontend/node_modules/.installed: frontend/package-lock.json
	cd frontend && npm ci
	@touch $@

install-backend:
ifdef HAS_UV
	cd backend && uv sync --locked
else
	@echo "!! uv is not installed (https://docs.astral.sh/uv/) - skipping the backend. The site still works in offline mode."
endif

dev: install ## Run the API and the web app together (Ctrl-C stops both)
	@echo ""
	@echo "  Web app  ->  http://localhost:$(WEB_PORT)"
ifdef HAS_UV
	@echo "  API      ->  http://localhost:$(API_PORT)/api/docs"
endif
	@echo ""
	@trap 'kill 0' INT TERM EXIT; \
	$(if $(HAS_UV),(cd backend && uv run uvicorn app.main:app --reload --port $(API_PORT)) &,) \
	(cd frontend && NEXT_PUBLIC_API_URL=$${NEXT_PUBLIC_API_URL-$(if $(HAS_UV),http://localhost:$(API_PORT),)} npm run dev -- --port $(WEB_PORT)) & \
	wait

dev-frontend: install-frontend ## Run only the web app (offline mode unless NEXT_PUBLIC_API_URL is set)
	cd frontend && npm run dev -- --port $(WEB_PORT)

dev-backend: install-backend ## Run only the API
	cd backend && uv run uvicorn app.main:app --reload --port $(API_PORT)

test: test-frontend test-backend ## Run all unit tests

test-frontend: install-frontend
	cd frontend && npm test

test-backend: install-backend
ifdef HAS_UV
	cd backend && uv run pytest -q
endif

lint: lint-frontend lint-backend ## Lint and type-check everything

lint-frontend: install-frontend
	cd frontend && npm run lint && npm run typecheck

lint-backend: install-backend
ifdef HAS_UV
	cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy app scripts
endif

typecheck: install-frontend ## Type-check the frontend
	cd frontend && npm run typecheck

build: install-frontend ## Production build of the web app
	cd frontend && npm run build

e2e: install ## Playwright end-to-end tests (installs Chromium on first run)
	cd frontend && npx playwright install chromium && npm run e2e

puzzles: install-backend ## Rebuild the puzzle set from the Lichess database (downloads ~300 MB)
	cd backend && uv run python scripts/build_puzzles.py

docker: ## Build both Docker images
	docker compose build

docker-up: ## Run the whole stack with Docker Compose
	docker compose up --build

clean: ## Remove build output and caches
	rm -rf frontend/.next frontend/test-results frontend/playwright-report
	rm -rf backend/.pytest_cache backend/.mypy_cache backend/.ruff_cache
