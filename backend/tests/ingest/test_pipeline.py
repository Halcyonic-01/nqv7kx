import json
import sqlite3
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import pytest

from beaufort.config import IngestWindow
from beaufort.elexon.client import ElexonError
from beaufort.ingest.pipeline import run_ingest

from .fakes import FakeElexon, fuelhh_day, windfor_run

WINDOW = IngestWindow(
    forecast_publish_from=datetime(2026, 1, 1, tzinfo=UTC),
    forecast_publish_to=datetime(2026, 1, 10, tzinfo=UTC),
    actual_date_from=date(2026, 1, 1),
    actual_date_to=date(2026, 1, 9),
)


def _fake() -> FakeElexon:
    forecasts = []
    for d in range(9):
        publish = datetime(2026, 1, 1 + d, 7, 30, tzinfo=UTC)
        forecasts += windfor_run(publish, publish + timedelta(hours=1), 24)
    actuals = [r for d in range(9) for r in fuelhh_day(date(2026, 1, 1 + d))]
    actuals.append({**actuals[0], "generation": -1, "startTime": "2026-01-01T12:15:00Z"})
    return FakeElexon(forecasts=forecasts, actuals=actuals)


def test_ingest_writes_db_and_manifest(tmp_path: Path) -> None:
    manifest = run_ingest(_fake().client(), tmp_path, WINDOW)

    assert manifest["rows"] == {"wind_forecast": 9 * 24, "wind_actual": 9 * 48}
    assert manifest["rejected_rows"] == {"wind_forecast": 0, "wind_actual": 1}
    assert manifest["quality"]["actuals"]["incomplete_days"] == {}
    assert json.loads((tmp_path / "manifest.json").read_text()) == manifest
    assert not list(tmp_path.glob("*.tmp"))

    conn = sqlite3.connect(tmp_path / "beaufort.sqlite")
    assert conn.execute("SELECT COUNT(*) FROM wind_actual").fetchone() == (9 * 48,)


def test_ingest_is_reproducible(tmp_path: Path) -> None:
    first = run_ingest(_fake().client(), tmp_path, WINDOW)
    second = run_ingest(_fake().client(), tmp_path, WINDOW)

    assert first["data_sha256"] == second["data_sha256"]
    assert first["rows"] == second["rows"]


def test_failed_ingest_keeps_previous_snapshot(tmp_path: Path) -> None:
    run_ingest(_fake().client(), tmp_path, WINDOW)
    before = (tmp_path / "beaufort.sqlite").read_bytes()

    broken = FakeElexon(fail_first=100)
    with pytest.raises(ElexonError):
        run_ingest(broken.client(max_attempts=1), tmp_path, WINDOW)

    assert (tmp_path / "beaufort.sqlite").read_bytes() == before
    assert not list(tmp_path.glob("*.tmp"))
