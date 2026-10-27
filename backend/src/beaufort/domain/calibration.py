from dataclasses import dataclass

import pandas as pd

TRAILING = pd.Timedelta(days=7)
MIN_HOURS = 72


@dataclass(frozen=True)
class Calibration:
    """Trailing actual/forecast ratio and its P10/P90 spread."""

    ratio: float
    q10: float
    q90: float
    n: int


def trailing_calibration(
    pairs: pd.DataFrame, cutoff: pd.Timestamp, window: pd.Timedelta = TRAILING
) -> Calibration | None:
    """From decision-time pairs whose actuals were published by `cutoff` (no look-ahead).

    pairs: start_time, forecast_mw, actual_mw, actual_publish_time.
    """
    known = pairs[
        (pairs["actual_publish_time"] <= cutoff)
        & (pairs["start_time"] >= cutoff - window)
        & (pairs["forecast_mw"] > 0)
    ].dropna(subset=["forecast_mw", "actual_mw"])
    if len(known) < MIN_HOURS:
        return None
    ratios = known["actual_mw"] / known["forecast_mw"]
    return Calibration(
        ratio=float(known["actual_mw"].sum() / known["forecast_mw"].sum()),
        q10=float(ratios.quantile(0.1)),
        q90=float(ratios.quantile(0.9)),
        n=len(known),
    )
