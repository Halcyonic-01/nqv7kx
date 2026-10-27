from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.gzip import GZipMiddleware

from beaufort import __version__
from beaufort.api import errors
from beaufort.api.deps import get_analytics
from beaufort.api.routes import analytics, health

API_PREFIX = "/api/v1"
# Data is immutable per snapshot: let browsers and the CDN cache it.
CACHE_CONTROL = "public, max-age=3600, s-maxage=604800"


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
    app.include_router(analytics.router, prefix=API_PREFIX)
    errors.install(app)
    app.add_middleware(GZipMiddleware, minimum_size=1024)

    @app.middleware("http")
    async def snapshot_cache(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        path = request.url.path
        if request.method != "GET" or not path.startswith(API_PREFIX) or path.endswith("/health"):
            return await call_next(request)
        provider = app.dependency_overrides.get(get_analytics, get_analytics)
        etag = f'"{provider().data_sha256[:16]}"'
        headers = {"ETag": etag, "Cache-Control": CACHE_CONTROL}
        if request.headers.get("if-none-match") == etag:
            return Response(status_code=304, headers=headers)
        response = await call_next(request)
        if response.status_code == 200:
            response.headers.update(headers)
        return response

    return app


app = create_app()
