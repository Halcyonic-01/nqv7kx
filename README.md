# Beaufort

Day-ahead wind forecast monitoring for GB. For each delivery day it shows the latest national wind forecast that was available at day-ahead gate closure, and measures how accurate those forecasts turned out to be. The data comes from Elexon BMRS: WINDFOR forecasts and FUELHH `WIND` outturn, covering purchase decisions made in January 2026.

**Live app:** <https://nqv7kx.vercel.app>

> Status: walking skeleton (API health check + web shell). Analytics land in later milestones.

## Run it

### Docker (recommended)

```bash
docker compose up --build
```

Then open <http://localhost:8080>. The `web` container (nginx) serves the built frontend and proxies `/api` to the `api` container (FastAPI/uvicorn).

### Local development

Requires Python 3.12 with [uv](https://docs.astral.sh/uv/), and Node 22.

```bash
make install
make dev        # API on :8000, web on :5173 (Vite proxies /api to the API)
make test
make lint
```

API docs: `/api/docs` (Swagger UI), `/api/openapi.json`.

## Repository layout

| Path | Purpose |
|---|---|
| `backend/` | Python package `beaufort` (FastAPI app, later ingest + analytics), tests, Dockerfile |
| `backend/src/beaufort/api/` | App factory and HTTP routes (`/api/v1/*`) |
| `backend/tests/` | pytest suite |
| `frontend/` | React + TypeScript (Vite) web app, nginx config and Dockerfile for the container |
| `api/index.py` | Vercel Python function entrypoint, re-exports the FastAPI app |
| `requirements.txt` | Runtime dependencies for the Vercel function, exported from `backend/uv.lock` (`make requirements`) |
| `vercel.json` | Vercel build, function bundling and rewrites (`/api/*` → function, everything else → SPA) |
| `docker-compose.yml` | Local production-like stack: `api` + `web` |
| `Makefile` | Common dev commands (`make help`) |

## Deployment

Vercel hosts the static frontend on its CDN and runs `api/index.py` as a Python function in London (`lhr1`), from the same repository. The frontend calls `/api` on its own origin in every environment: Vite proxies it in local dev, nginx in Docker, and Vercel rewrites in production. So there is no CORS configuration, and the frontend build is identical everywhere.

## AI usage

This project was built with the help of AI tools (Claude Code), used for scaffolding and implementation. Every change was reviewed, and its behaviour was checked with tests and by running the app.
