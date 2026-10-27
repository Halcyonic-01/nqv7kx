from datetime import UTC, date, datetime, timedelta
from typing import Any

import httpx

from beaufort.config import ELEXON_BASE_URL
from beaufort.elexon.client import ElexonClient


def iso(ts: datetime) -> str:
    return ts.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def windfor_run(
    publish: datetime, first_start: datetime, hours: int, mw: int = 1000
) -> list[dict[str, Any]]:
    return [
        {
            "dataset": "WINDFOR",
            "publishTime": iso(publish),
            "startTime": iso(first_start + timedelta(hours=h)),
            "generation": mw + h,
        }
        for h in range(hours)
    ]


def fuelhh_day(day: date, mw: int = 900, periods: int = 48) -> list[dict[str, Any]]:
    """Winter day (UK local == UTC)."""
    midnight = datetime(day.year, day.month, day.day, tzinfo=UTC)
    rows = []
    for sp in range(1, periods + 1):
        start = midnight + timedelta(minutes=30 * (sp - 1))
        rows.append(
            {
                "dataset": "FUELHH",
                "publishTime": iso(start + timedelta(minutes=30)),
                "startTime": iso(start),
                "settlementDate": day.isoformat(),
                "settlementPeriod": sp,
                "fuelType": "WIND",
                "generation": mw + sp,
            }
        )
    return rows


class FakeElexon:
    """In-memory BMRS stream endpoints, filtered like the real API."""

    def __init__(
        self,
        forecasts: list[dict[str, Any]] | None = None,
        actuals: list[dict[str, Any]] | None = None,
        fail_first: int = 0,
        fail_status: int = 503,
    ) -> None:
        self.forecasts = forecasts or []
        self.actuals = actuals or []
        self.fail_first = fail_first
        self.fail_status = fail_status
        self.requests: list[httpx.Request] = []
        self.sleeps: list[float] = []

    def client(self, max_attempts: int = 5) -> ElexonClient:
        http = httpx.Client(base_url=ELEXON_BASE_URL, transport=httpx.MockTransport(self._handle))
        return ElexonClient(http, max_attempts=max_attempts, sleep=self.sleeps.append)

    def _handle(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if len(self.requests) <= self.fail_first:
            return httpx.Response(self.fail_status)
        q = request.url.params
        if request.url.path.endswith("/datasets/WINDFOR/stream"):
            lo, hi = q["publishDateTimeFrom"], q["publishDateTimeTo"]
            return httpx.Response(
                200, json=[r for r in self.forecasts if lo <= r["publishTime"] <= hi]
            )
        if request.url.path.endswith("/datasets/FUELHH/stream"):
            lo, hi = q["settlementDateFrom"], q["settlementDateTo"]
            rows = [
                r
                for r in self.actuals
                if lo <= r["settlementDate"] <= hi and r["fuelType"] == q["fuelType"]
            ]
            return httpx.Response(200, json=rows)
        return httpx.Response(404)
