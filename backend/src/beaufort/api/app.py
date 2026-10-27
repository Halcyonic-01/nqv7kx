from fastapi import FastAPI

from beaufort import __version__
from beaufort.api.routes import health

API_PREFIX = "/api/v1"


def create_app() -> FastAPI:
    # Docs under /api so the same proxy rule serves them.
    app = FastAPI(
        title="Beaufort API",
        version=__version__,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
    )
    app.include_router(health.router, prefix=API_PREFIX)
    return app


app = create_app()
