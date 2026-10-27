"""Vercel entrypoint: serves the FastAPI app as a Python function.

Vercel rewrites /api/* here (see vercel.json) and passes the original path through,
so the app's own /api/v1/... routes match unchanged.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend" / "src"))

from beaufort.api.app import app  # noqa: E402

__all__ = ["app"]
