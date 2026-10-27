from dataclasses import dataclass

import numpy as np
import numpy.typing as npt

FloatArray = npt.NDArray[np.float64]


@dataclass(frozen=True)
class ErrorSummary:
    """Error = forecast - actual (positive: over-forecast, i.e. wind shortfall)."""

    n: int
    mae_mw: float
    rmse_mw: float
    bias_mw: float
    wape_pct: float
    p50_abs_mw: float
    p90_abs_mw: float
    p99_abs_mw: float
    p10_mw: float
    p90_mw: float
    over_forecast_pct: float


def _paired(forecast: npt.ArrayLike, actual: npt.ArrayLike) -> tuple[FloatArray, FloatArray]:
    f = np.asarray(forecast, dtype=float)
    a = np.asarray(actual, dtype=float)
    ok = ~(np.isnan(f) | np.isnan(a))
    return f[ok], a[ok]


def error_summary(forecast: npt.ArrayLike, actual: npt.ArrayLike) -> ErrorSummary | None:
    f, a = _paired(forecast, actual)
    if f.size == 0:
        return None
    err = f - a
    abs_err = np.abs(err)
    total = a.sum()
    return ErrorSummary(
        n=int(err.size),
        mae_mw=float(abs_err.mean()),
        rmse_mw=float(np.sqrt((err**2).mean())),
        bias_mw=float(err.mean()),
        wape_pct=float(abs_err.sum() / total * 100) if total > 0 else float("nan"),
        p50_abs_mw=float(np.quantile(abs_err, 0.5)),
        p90_abs_mw=float(np.quantile(abs_err, 0.9)),
        p99_abs_mw=float(np.quantile(abs_err, 0.99)),
        p10_mw=float(np.quantile(err, 0.1)),
        p90_mw=float(np.quantile(err, 0.9)),
        over_forecast_pct=float((err > 0).mean() * 100),
    )


def histogram(errors: npt.ArrayLike, bin_mw: int = 500) -> tuple[list[int], list[int]]:
    """Signed error histogram with edges on multiples of bin_mw."""
    e = np.asarray(errors, dtype=float)
    e = e[~np.isnan(e)]
    if e.size == 0:
        return [], []
    lo = int(np.floor(e.min() / bin_mw) * bin_mw)
    hi = int(np.floor(e.max() / bin_mw) * bin_mw) + bin_mw
    edges = np.arange(lo, hi + bin_mw, bin_mw)
    counts, _ = np.histogram(e, bins=edges)
    return [int(x) for x in edges], [int(x) for x in counts]
