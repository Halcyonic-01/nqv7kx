from typing import Any

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

PROBLEM_JSON = "application/problem+json"


class ProblemError(Exception):
    def __init__(self, status: int, title: str, detail: str) -> None:
        self.status, self.title, self.detail = status, title, detail


def _problem(status: int, title: str, detail: str, **extra: Any) -> JSONResponse:
    body = {"type": "about:blank", "title": title, "status": status, "detail": detail, **extra}
    return JSONResponse(jsonable_encoder(body), status_code=status, media_type=PROBLEM_JSON)


def install(app: FastAPI) -> None:
    @app.exception_handler(ProblemError)
    async def _on_problem(_: Request, exc: ProblemError) -> JSONResponse:
        return _problem(exc.status, exc.title, exc.detail)

    @app.exception_handler(RequestValidationError)
    async def _on_invalid(_: Request, exc: RequestValidationError) -> JSONResponse:
        return _problem(
            422, "Invalid request", "Query parameters failed validation", errors=exc.errors()
        )
