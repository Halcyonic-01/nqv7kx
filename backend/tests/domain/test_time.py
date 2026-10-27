from datetime import UTC, date, datetime, time

from beaufort.domain.time import delivery_window, gate_closure, hourly_targets, parse_hhmm


def utc(*args: int) -> datetime:
    return datetime(*args, tzinfo=UTC)


def test_winter_delivery_day_is_23_to_23_utc() -> None:
    assert delivery_window(date(2026, 1, 15)) == (utc(2026, 1, 14, 23), utc(2026, 1, 15, 23))
    assert len(hourly_targets(date(2026, 1, 15))) == 24


def test_clock_change_days_have_23_and_25_hours() -> None:
    assert delivery_window(date(2026, 3, 29)) == (utc(2026, 3, 28, 23), utc(2026, 3, 29, 22))
    assert len(hourly_targets(date(2026, 3, 29))) == 23
    assert delivery_window(date(2026, 10, 25)) == (utc(2026, 10, 24, 22), utc(2026, 10, 25, 23))
    assert len(hourly_targets(date(2026, 10, 25))) == 25


def test_gate_closure_is_uk_local_on_previous_day() -> None:
    assert gate_closure(date(2026, 1, 15), time(9, 20)) == utc(2026, 1, 14, 9, 20)
    assert gate_closure(date(2026, 6, 15), time(9, 20)) == utc(2026, 6, 14, 8, 20)


def test_parse_hhmm() -> None:
    assert parse_hhmm("09:50") == time(9, 50)
