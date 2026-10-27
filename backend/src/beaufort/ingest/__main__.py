"""Rebuild the Elexon snapshot: python -m beaufort.ingest"""

import argparse
import json
import logging
from datetime import UTC, date, datetime
from pathlib import Path

from beaufort.config import DATA_DIR, DEFAULT_WINDOW, IngestWindow
from beaufort.elexon.client import ElexonClient
from beaufort.ingest.pipeline import run_ingest


def _utc(value: str) -> datetime:
    return datetime.fromisoformat(value).replace(tzinfo=UTC)


def main() -> None:
    w = DEFAULT_WINDOW
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=DATA_DIR)
    parser.add_argument("--forecast-from", type=_utc, default=w.forecast_publish_from)
    parser.add_argument("--forecast-to", type=_utc, default=w.forecast_publish_to)
    parser.add_argument("--actual-from", type=date.fromisoformat, default=w.actual_date_from)
    parser.add_argument("--actual-to", type=date.fromisoformat, default=w.actual_date_to)
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    window = IngestWindow(args.forecast_from, args.forecast_to, args.actual_from, args.actual_to)
    manifest = run_ingest(ElexonClient(), args.out, window)
    print(json.dumps({k: manifest[k] for k in ("rows", "rejected_rows", "quality")}, indent=2))


if __name__ == "__main__":
    main()
