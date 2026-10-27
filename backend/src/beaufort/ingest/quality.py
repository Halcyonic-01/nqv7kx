import sqlite3
from collections import Counter
from datetime import UTC, date, datetime, time, timedelta
from itertools import pairwise
from typing import Any

from beaufort.config import LONDON, IngestWindow

# WINDFOR schedule observed in the API (Elexon docs still say 4 runs/day).
EXPECTED_RUN_TIMES_UTC = ("02:30", "04:30", "07:30", "09:30", "11:30", "15:30", "18:30", "22:30")


def periods_in_day(day: date) -> int:
    """Settlement periods in a UK day: 48, or 46/50 on clock-change days."""
    start = datetime.combine(day, time(), LONDON).astimezone(UTC)
    end = datetime.combine(day + timedelta(days=1), time(), LONDON).astimezone(UTC)
    return int((end - start).total_seconds() // 1800)


def quality_report(conn: sqlite3.Connection, window: IngestWindow) -> dict[str, Any]:
    return {"actuals": _actuals(conn, window), "forecasts": _forecasts(conn, window)}


def _actuals(conn: sqlite3.Connection, window: IngestWindow) -> dict[str, Any]:
    found = dict(
        conn.execute("SELECT settlement_date, COUNT(*) FROM wind_actual GROUP BY settlement_date")
    )
    expected_total = 0
    incomplete: dict[str, dict[str, int]] = {}
    day = window.actual_date_from
    while day <= window.actual_date_to:
        expected = periods_in_day(day)
        expected_total += expected
        have = found.get(day.isoformat(), 0)
        if have != expected:
            incomplete[day.isoformat()] = {"expected": expected, "found": have}
        day += timedelta(days=1)
    return {
        "expected_periods": expected_total,
        "found_periods": sum(found.values()),
        "incomplete_days": incomplete,
    }


def _forecasts(conn: sqlite3.Connection, window: IngestWindow) -> dict[str, Any]:
    runs = conn.execute(
        """
        SELECT publish_time, COUNT(*), MIN(start_time), MAX(start_time)
        FROM wind_forecast GROUP BY publish_time ORDER BY publish_time
        """
    ).fetchall()
    published = [datetime.fromtimestamp(r[0], UTC) for r in runs]

    runs_per_day = Counter(p.date() for p in published)
    irregular_days: dict[str, int] = {}
    day = window.forecast_publish_from.astimezone(UTC).date()
    last_day = (window.forecast_publish_to.astimezone(UTC) - timedelta(seconds=1)).date()
    while day <= last_day:
        if runs_per_day[day] != len(EXPECTED_RUN_TIMES_UTC):
            irregular_days[day.isoformat()] = runs_per_day[day]
        day += timedelta(days=1)

    gaps_h = [(b - a).total_seconds() / 3600 for a, b in pairwise(published)]
    return {
        "runs": len(runs),
        "points": sum(r[1] for r in runs),
        "points_per_run": {str(k): v for k, v in sorted(Counter(r[1] for r in runs).items())},
        "irregular_days": irregular_days,
        "off_schedule_runs": [
            p.isoformat() for p in published if p.strftime("%H:%M") not in EXPECTED_RUN_TIMES_UTC
        ],
        "max_gap_hours": max(gaps_h, default=0.0),
        "max_lead_hours": max(((r[3] - r[0]) / 3600 for r in runs), default=0.0),
    }
