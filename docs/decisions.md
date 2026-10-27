# Decisions

Short records of the choices that shape the codebase: context, decision, consequences.

## 1. Committed data snapshot instead of live Elexon calls

**Context.** The data is historical (January 2026) and small: about 22k rows. Elexon responses take 1–3 s, and graders open the app at arbitrary times.

**Decision.** An ingest CLI builds `data/beaufort.sqlite` and `manifest.json`, which are committed. The API never calls Elexon.

**Consequences.**
- Numbers are deterministic, and cold starts don't depend on a third party.
- The manifest records source parameters, row counts, a content hash and a quality report.
- Refreshing means running `make ingest`.
- For live use, the same pipeline would run on a schedule into a database.

## 2. SQLite + pandas, not Postgres / DuckDB / Parquet

**Context.** The dataset is tiny and read-only at runtime, and Vercel bundles have a size limit.

**Decision.**
- SQLite (stdlib) for storage, with natural-key upserts.
- pandas in memory for analytics.
- No pyarrow.

**Consequences.**
- No database service to run or pay for. The function bundle is about 53 MB.
- Storage sits behind `store/`, so moving to Postgres/Timescale is a contained change.

## 3. Forecast selection as an as-of join

**Context.** The core business rule is "latest run published by the cutoff, for each target hour".

**Decision.** `pandas.merge_asof(by=startTime, left_on=cutoff, right_on=publishTime, direction="backward")` over rows with positive lead time. The same function serves both gate-closure mode and lead-time mode; only the cutoff column differs.

**Consequences.**
- One readable line encodes the rule.
- It is verified by edge-case tests (run exactly at cutoff, run 1 s after, hindcast points, missing hour, late run) and by a Hypothesis property test against brute force.

## 4. Delivery day 23:00–23:00 and EPEX 09:20 as defaults

**Context.** GB day-ahead auctions deliver 23:00 D−1 to 23:00 D. EPEX closes at 09:20 and N2EX at 09:50.

**Decision.** Default to the earlier, conservative EPEX gate closure. Offer N2EX as a one-click switch, carried in the URL.

**Consequences.**
- The decision rule is shown on screen. Either convention can be checked with the client without code changes.

## 5. ECharts with a token-driven theme

**Context.** The charts need stepped series, shaded bands, marked areas, linked crosshairs, histograms and click-through, all polished in both themes, within a 16-hour budget.

**Decision.**
- Apache ECharts (modular imports, canvas renderer) behind a small `EChart` wrapper.
- Colours come from CSS custom properties.
- The series palette was validated for colour-blind separation and contrast in light and dark.

**Consequences.**
- About 180 kB gzip, in a separately cached vendor chunk.
- Recharts was rejected (weak band/marker support); visx was rejected (too slow to build within budget).

## 6. Vercel for production, Docker for local and CI

**Context.** The brief allows Vercel or Heroku and asks for Docker.

**Decision.**
- Vercel serves the static build from its CDN and runs the same FastAPI app as a Python function in London (`lhr1`).
- Docker Compose (nginx + uvicorn) mirrors that topology locally, and CI builds and smoke-tests it.

**Consequences.**
- Free, always-on hosting. Immutable responses are cached at the edge, so a cached request takes about 0.2 s.
- Heroku's container stack is the fallback; the backend image is already deployable there.

## 7. Same-origin `/api` everywhere

**Decision.** Vite proxies `/api` in dev, nginx in Docker, and Vercel rewrites in production.

**Consequences.**
- No CORS configuration.
- One frontend build for every environment.
- API docs are served under `/api/docs` through the same rule.

## 8. Generated API types, checked in CI

**Decision.** `make types` exports FastAPI's OpenAPI schema and runs `openapi-typescript` (pinned, via `npx`, because the project uses TypeScript 7). CI regenerates the types and fails on any diff.

**Consequences.** A backend response-model change cannot silently break the frontend.
