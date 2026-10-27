from datetime import UTC, date, datetime

from beaufort.elexon.models import ActualRow, ForecastRow, parse_rows

from .fakes import fuelhh_day, windfor_run


def test_valid_rows_parse_to_utc_models() -> None:
    raw = windfor_run(
        datetime(2026, 1, 1, 7, 30, tzinfo=UTC), datetime(2026, 1, 1, 9, tzinfo=UTC), 2
    )
    rows, rejected = parse_rows(ForecastRow, raw)

    assert rejected == 0
    assert rows[0].start_time == datetime(2026, 1, 1, 9, tzinfo=UTC)
    assert rows[0].generation_mw == 1000


def test_invalid_rows_are_rejected_not_raised() -> None:
    good = fuelhh_day(date(2026, 1, 1), periods=1)[0]
    raw = [
        good,
        {**good, "generation": -5},
        {**good, "startTime": "2026-01-01T00:00:00"},  # naive
        {**good, "fuelType": "CCGT"},
        {**good, "settlementPeriod": 0},
        {k: v for k, v in good.items() if k != "generation"},
    ]
    rows, rejected = parse_rows(ActualRow, raw)

    assert len(rows) == 1
    assert rejected == 5


def test_fractional_generation_is_rounded() -> None:
    raw = [{**fuelhh_day(date(2026, 1, 1), periods=1)[0], "generation": 1234.6}]
    rows, _ = parse_rows(ActualRow, raw)
    assert rows[0].generation_mw == 1235
