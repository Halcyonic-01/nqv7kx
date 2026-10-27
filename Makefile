.DEFAULT_GOAL := help
.PHONY: help install dev dev-api dev-web test lint fmt requirements up down

BACKEND := uv run --directory backend

help: ## List targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  %-14s %s\n", $$1, $$2}'

install: ## Install backend and frontend dependencies
	uv sync --directory backend
	npm ci --prefix frontend

dev: ## Run API (:8000) and web (:5173) with reload
	$(MAKE) -j2 dev-api dev-web

dev-api:
	$(BACKEND) uvicorn beaufort.api.app:app --reload --port 8000

dev-web:
	npm run dev --prefix frontend

test: ## Run all tests
	$(BACKEND) pytest

lint: ## Lint and type-check everything
	$(BACKEND) ruff check .
	$(BACKEND) ruff format --check .
	$(BACKEND) mypy
	npm run lint --prefix frontend
	npm run build --prefix frontend

fmt: ## Auto-format backend code
	$(BACKEND) ruff format .
	$(BACKEND) ruff check --fix .

requirements: ## Re-export requirements.txt (used by the Vercel Python function)
	uv export --directory backend --no-dev --no-hashes --no-emit-project --no-header -q -o ../requirements.txt

up: ## Build and run the full stack in Docker on http://localhost:8080
	docker compose up --build

down: ## Stop the Docker stack
	docker compose down
