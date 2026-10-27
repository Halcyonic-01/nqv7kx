from datetime import UTC, date, datetime

import pytest

from beaufort.elexon.client import ElexonError

from .fakes import FakeElexon


def test_forecasts_are_fetched_in_7_day_chunks() -> None:
    fake = FakeElexon()
    chunks = list(
        fake.client().wind_forecasts(
            datetime(2026, 1, 1, tzinfo=UTC), datetime(2026, 1, 16, tzinfo=UTC)
        )
    )

    assert len(chunks) == 3
    params = [
        (r.url.params["publishDateTimeFrom"], r.url.params["publishDateTimeTo"])
        for r in fake.requests
    ]
    assert params == [
        ("2026-01-01T00:00:00Z", "2026-01-08T00:00:00Z"),
        ("2026-01-08T00:00:00Z", "2026-01-15T00:00:00Z"),
        ("2026-01-15T00:00:00Z", "2026-01-16T00:00:00Z"),
    ]


def test_actuals_chunks_cover_dates_without_overlap() -> None:
    fake = FakeElexon()
    list(fake.client().wind_actuals(date(2026, 1, 1), date(2026, 1, 10)))

    params = [
        (r.url.params["settlementDateFrom"], r.url.params["settlementDateTo"])
        for r in fake.requests
    ]
    assert params == [("2026-01-01", "2026-01-07"), ("2026-01-08", "2026-01-10")]
    assert all(r.url.params["fuelType"] == "WIND" for r in fake.requests)


def test_retries_transient_errors_with_backoff() -> None:
    fake = FakeElexon(fail_first=2)
    list(fake.client().wind_actuals(date(2026, 1, 1), date(2026, 1, 1)))

    assert len(fake.requests) == 3
    assert fake.sleeps == [0.5, 1.0]


def test_gives_up_after_max_attempts() -> None:
    fake = FakeElexon(fail_first=10)
    with pytest.raises(ElexonError, match="after 3 attempts"):
        list(fake.client(max_attempts=3).wind_actuals(date(2026, 1, 1), date(2026, 1, 1)))
    assert len(fake.requests) == 3


def test_client_errors_are_not_retried() -> None:
    fake = FakeElexon(fail_first=1, fail_status=400)
    with pytest.raises(ElexonError, match="HTTP 400"):
        list(fake.client().wind_actuals(date(2026, 1, 1), date(2026, 1, 1)))
    assert len(fake.requests) == 1
