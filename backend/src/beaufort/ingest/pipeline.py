import json
import logging
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from beaufort.config import DB_FILENAME, ELEXON_BASE_URL, MANIFEST_FILENAME, IngestWindow
from beaufort.elexon.client import ElexonClient
from beaufort.elexon.models import ActualRow, ForecastRow, parse_rows
from beaufort.ingest.quality import quality_report
from beaufort.store import db

log = logging.getLogger(__name__)


def run_ingest(client: ElexonClient, out_dir: Path, window: IngestWindow) -> dict[str, Any]:
    """Rebuild the snapshot DB and manifest in out_dir; returns the manifest."""
    out_dir.mkdir(parents=True, exist_ok=True)
    db_path = out_dir / DB_FILENAME
    tmp_path = db_path.with_suffix(".tmp")
    tmp_path.unlink(missing_ok=True)

    rejected = {"wind_forecast": 0, "wind_actual": 0}
    conn = db.connect(tmp_path)
    try:
        with conn:
            for chunk in client.wind_forecasts(
                window.forecast_publish_from, window.forecast_publish_to
            ):
                forecasts, bad = parse_rows(ForecastRow, chunk)
                db.upsert_forecasts(conn, forecasts)
                rejected["wind_forecast"] += bad
            for chunk in client.wind_actuals(window.actual_date_from, window.actual_date_to):
                actuals, bad = parse_rows(ActualRow, chunk)
                db.upsert_actuals(conn, actuals)
                rejected["wind_actual"] += bad
        conn.execute("VACUUM")

        manifest = {
            "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
            "source": {
                "base_url": ELEXON_BASE_URL,
                "forecast": {
                    "dataset": "WINDFOR",
                    "publish_from": window.forecast_publish_from.isoformat(),
                    "publish_to": window.forecast_publish_to.isoformat(),
                },
                "actual": {
                    "dataset": "FUELHH",
                    "fuel_type": "WIND",
                    "settlement_date_from": window.actual_date_from.isoformat(),
                    "settlement_date_to": window.actual_date_to.isoformat(),
                },
            },
            "rows": db.row_counts(conn),
            "rejected_rows": rejected,
            "data_sha256": db.content_sha256(conn),
            "quality": quality_report(conn, window),
        }
    except BaseException:
        conn.close()
        tmp_path.unlink(missing_ok=True)
        raise
    conn.close()

    os.replace(tmp_path, db_path)
    (out_dir / MANIFEST_FILENAME).write_text(json.dumps(manifest, indent=2) + "\n")
    log.info("Wrote %s (%s)", db_path, manifest["rows"])
    return manifest
