import platform
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from beaufort import __version__

router = APIRouter(tags=["system"])


class Health(BaseModel):
    status: Literal["ok"]
    version: str
    python: str


@router.get("/health")
def health() -> Health:
    return Health(status="ok", version=__version__, python=platform.python_version())
