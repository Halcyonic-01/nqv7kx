from datetime import UTC, date, datetime
from pathlib import Path

from beaufort.elexon.models import ActualRow, ForecastRow, parse_rows
from beaufort.store import db

from .fakes import fuelhh_day, windfor_run


def _actual(publish_time: str, mw: int) -> ActualRow:
    raw = {
        **fuelhh_day(date(2026, 1, 1), periods=1)[0],
        "publishTime": publish_time,
        "generation": mw,
    }
    return ActualRow.model_validate(raw)


def test_actual_upsert_keeps_latest_publication(tmp_path: Path) -> None:
    conn = db.connect(tmp_path / "t.sqlite")
    db.upsert_actuals(conn, [_actual("2026-01-01T01:00:00Z", 200)])
    db.upsert_actuals(conn, [_actual("2026-01-01T00:30:00Z", 100)])  # older revision

    assert conn.execute("SELECT generation_mw FROM wind_actual").fetchall() == [(200,)]


def test_forecast_upsert_dedupes_on_run_and_hour(tmp_path: Path) -> None:
    conn = db.connect(tmp_path / "t.sqlite")
    run = windfor_run(datetime(2026, 1, 1, 7, 30, tzinfo=UTC), datetime(2026, 1, 2, tzinfo=UTC), 3)
    rows, _ = parse_rows(ForecastRow, run)
    db.upsert_forecasts(conn, rows)
    db.upsert_forecasts(conn, rows)

    assert db.row_counts(conn) == {"wind_forecast": 3, "wind_actual": 0}


def test_content_hash_ignores_insert_order(tmp_path: Path) -> None:
    rows, _ = parse_rows(ActualRow, fuelhh_day(date(2026, 1, 1)))
    a = db.connect(tmp_path / "a.sqlite")
    b = db.connect(tmp_path / "b.sqlite")
    db.upsert_actuals(a, rows)
    db.upsert_actuals(b, reversed(rows))

    assert db.content_sha256(a) == db.content_sha256(b)
