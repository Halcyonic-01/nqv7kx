"""Vercel entrypoint for the FastAPI app."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend" / "src"))

from beaufort.api.app import app  # noqa: E402

__all__ = ["app"]
