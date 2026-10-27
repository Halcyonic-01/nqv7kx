import logging
import time
from collections.abc import Callable, Iterator
from datetime import UTC, date, datetime, timedelta
from typing import Any

import httpx

from beaufort.config import ELEXON_BASE_URL

log = logging.getLogger(__name__)

_RETRYABLE_STATUS = {429, 500, 502, 503, 504}


class ElexonError(RuntimeError):
    pass


class ElexonClient:
    """Typed access to the BMRS stream endpoints, with chunking and retries."""

    def __init__(
        self,
        http: httpx.Client | None = None,
        *,
        max_attempts: int = 5,
        backoff_s: float = 0.5,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._http = http or httpx.Client(base_url=ELEXON_BASE_URL, timeout=30.0)
        self._max_attempts = max_attempts
        self._backoff_s = backoff_s
        self._sleep = sleep

    def wind_forecasts(
        self, publish_from: datetime, publish_to: datetime, chunk: timedelta = timedelta(days=7)
    ) -> Iterator[list[dict[str, Any]]]:
        start = publish_from
        while start < publish_to:
            end = min(start + chunk, publish_to)
            yield self._get(
                "/datasets/WINDFOR/stream",
                {"publishDateTimeFrom": _iso(start), "publishDateTimeTo": _iso(end)},
            )
            start = end

    def wind_actuals(
        self, date_from: date, date_to: date, chunk_days: int = 7
    ) -> Iterator[list[dict[str, Any]]]:
        start = date_from
        while start <= date_to:
            end = min(start + timedelta(days=chunk_days - 1), date_to)
            yield self._get(
                "/datasets/FUELHH/stream",
                {
                    "settlementDateFrom": start.isoformat(),
                    "settlementDateTo": end.isoformat(),
                    "fuelType": "WIND",
                },
            )
            start = end + timedelta(days=1)

    def _get(self, path: str, params: dict[str, str]) -> list[dict[str, Any]]:
        for attempt in range(1, self._max_attempts + 1):
            try:
                response = self._http.get(path, params=params)
            except httpx.TransportError as exc:
                failure = f"{type(exc).__name__}: {exc}"
            else:
                if response.status_code not in _RETRYABLE_STATUS:
                    if response.is_error:
                        raise ElexonError(f"{path} {params} -> HTTP {response.status_code}")
                    body = response.json()
                    if not isinstance(body, list):
                        raise ElexonError(f"{path}: expected a JSON array")
                    log.info("%s %s -> %d rows", path, params, len(body))
                    return body
                failure = f"HTTP {response.status_code}"

            if attempt == self._max_attempts:
                raise ElexonError(f"{path} {params} failed after {attempt} attempts: {failure}")
            delay = self._backoff_s * 2 ** (attempt - 1)
            log.warning("%s failed (%s); retry %d in %.1fs", path, failure, attempt, delay)
            self._sleep(delay)
        raise AssertionError("unreachable")


def _iso(ts: datetime) -> str:
    return ts.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
