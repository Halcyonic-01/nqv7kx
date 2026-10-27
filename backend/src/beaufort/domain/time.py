from datetime import UTC, date, datetime, time, timedelta

import pandas as pd

from beaufort.config import LONDON

TS_DTYPE = "datetime64[ns, UTC]"
DELIVERY_DAY_START = time(23)


def delivery_window(day: date) -> tuple[datetime, datetime]:
    """Auction (EFA) day: 23:00 on day-1 to 23:00 on day, UK local, as UTC."""
    start = datetime.combine(day - timedelta(days=1), DELIVERY_DAY_START, LONDON)
    end = datetime.combine(day, DELIVERY_DAY_START, LONDON)
    return start.astimezone(UTC), end.astimezone(UTC)


def gate_closure(day: date, at: time) -> datetime:
    """Decision cutoff: `at` UK local on day-1, as UTC."""
    return datetime.combine(day - timedelta(days=1), at, LONDON).astimezone(UTC)


def hourly_targets(day: date) -> pd.DatetimeIndex:
    start, end = delivery_window(day)
    return pd.date_range(start, end, freq="h", inclusive="left").astype(TS_DTYPE)


def parse_hhmm(value: str) -> time:
    hours, minutes = value.split(":")
    return time(int(hours), int(minutes))


def days(first: date, last: date) -> list[date]:
    return [first + timedelta(days=i) for i in range((last - first).days + 1)]
