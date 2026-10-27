import pandas as pd
import pytest

from beaufort.domain.calibration import trailing_calibration

CUTOFF = pd.Timestamp("2026-01-20 09:20", tz="UTC")


def pairs(hours: int, forecast: float = 1000, actual: float = 800) -> pd.DataFrame:
    start = pd.date_range(CUTOFF - pd.Timedelta(hours=hours), periods=hours, freq="h")
    return pd.DataFrame(
        {
            "start_time": start,
            "forecast_mw": forecast,
            "actual_mw": actual,
            "actual_publish_time": start + pd.Timedelta(minutes=30),
        }
    )


def test_ratio_from_trailing_history() -> None:
    cal = trailing_calibration(pairs(100), CUTOFF)
    assert cal is not None
    assert cal.ratio == pytest.approx(0.8)
    assert cal.q10 == pytest.approx(0.8) and cal.q90 == pytest.approx(0.8)


def test_actuals_published_after_cutoff_are_ignored() -> None:
    future = pairs(1, actual=1_000_000)
    future["actual_publish_time"] = CUTOFF + pd.Timedelta(seconds=1)
    cal = trailing_calibration(pd.concat([pairs(100), future]), CUTOFF)
    assert cal is not None
    assert cal.ratio == pytest.approx(0.8)


def test_history_older_than_window_is_ignored() -> None:
    old = pairs(24 * 10, actual=100)
    cal = trailing_calibration(
        pd.concat([old, pairs(100)]).drop_duplicates("start_time", keep="last"), CUTOFF
    )
    assert cal is not None
    assert cal.n == 24 * 7


def test_too_little_history_returns_none() -> None:
    assert trailing_calibration(pairs(71), CUTOFF) is None
