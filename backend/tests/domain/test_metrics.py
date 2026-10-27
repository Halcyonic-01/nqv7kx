import math

import pytest

from beaufort.domain.metrics import error_summary, histogram


def test_summary_against_hand_computed_values() -> None:
    s = error_summary([110, 90, 130, 100], [100, 100, 100, 100])
    assert s is not None
    assert s.n == 4
    assert s.mae_mw == pytest.approx(12.5)  # |10|+|-10|+|30|+0 / 4
    assert s.bias_mw == pytest.approx(7.5)
    assert s.rmse_mw == pytest.approx(math.sqrt((100 + 100 + 900) / 4))
    assert s.wape_pct == pytest.approx(12.5)
    assert s.over_forecast_pct == pytest.approx(50)


def test_nan_pairs_are_dropped_and_empty_gives_none() -> None:
    s = error_summary([100, float("nan")], [90, 80])
    assert s is not None and s.n == 1
    assert error_summary([float("nan")], [1.0]) is None


def test_histogram_bins_on_multiples() -> None:
    edges, counts = histogram([-600, -10, 0, 499, 500, 1200], bin_mw=500)
    assert edges == [-1000, -500, 0, 500, 1000, 1500]
    assert counts == [1, 1, 2, 1, 1]
