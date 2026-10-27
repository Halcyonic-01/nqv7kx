from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import pytest

from beaufort.config import IngestWindow
from beaufort.elexon.models import ActualRow, ForecastRow, parse_rows
from beaufort.ingest.quality import EXPECTED_RUN_TIMES_UTC, periods_in_day, quality_report
from beaufort.store import db

from .fakes import fuelhh_day, windfor_run

WINDOW = IngestWindow(
    forecast_publish_from=datetime(2026, 1, 1, tzinfo=UTC),
    forecast_publish_to=datetime(2026, 1, 3, tzinfo=UTC),
    actual_date_from=date(2026, 1, 1),
    actual_date_to=date(2026, 1, 2),
)


@pytest.mark.parametrize(
    ("day", "expected"),
    [(date(2026, 1, 15), 48), (date(2026, 3, 29), 46), (date(2026, 10, 25), 50)],
)
def test_periods_in_day_handles_clock_changes(day: date, expected: int) -> None:
    assert periods_in_day(day) == expected


def _runs(day: date, times: tuple[str, ...]) -> list[dict[str, object]]:
    raw = []
    for hhmm in times:
        h, m = map(int, hhmm.split(":"))
        publish = datetime(day.year, day.month, day.day, h, m, tzinfo=UTC)
        raw += windfor_run(publish, publish - timedelta(hours=2), 4)
    return raw


def test_report_flags_missing_periods_and_irregular_runs(tmp_path: Path) -> None:
    conn = db.connect(tmp_path / "t.sqlite")
    actuals = fuelhh_day(date(2026, 1, 1)) + fuelhh_day(date(2026, 1, 2))[:-1]
    db.upsert_actuals(conn, parse_rows(ActualRow, actuals)[0])
    late = ("02:30", "04:30", "07:30", "09:30", "12:25", "15:30", "18:30", "22:30")
    forecasts = _runs(date(2026, 1, 1), EXPECTED_RUN_TIMES_UTC) + _runs(date(2026, 1, 2), late[:-1])
    db.upsert_forecasts(conn, parse_rows(ForecastRow, forecasts)[0])

    report = quality_report(conn, WINDOW)

    assert report["actuals"]["incomplete_days"] == {"2026-01-02": {"expected": 48, "found": 47}}
    assert report["forecasts"]["irregular_days"] == {"2026-01-02": 7}
    assert report["forecasts"]["off_schedule_runs"] == ["2026-01-02T12:25:00+00:00"]
    assert report["forecasts"]["points_per_run"] == {"4": 15}
