from datetime import UTC, datetime, timedelta

import pandas as pd
from hypothesis import given, settings
from hypothesis import strategies as st

from beaufort.domain.selection import select_at_cutoff

T0 = datetime(2026, 1, 10, tzinfo=UTC)


def h(hours: float) -> datetime:
    return T0 + timedelta(hours=hours)


def forecasts(rows: list[tuple[float, float, int]]) -> pd.DataFrame:
    return pd.DataFrame(
        [(h(p), h(s), mw) for p, s, mw in rows],
        columns=["publish_time", "start_time", "generation_mw"],
    )


def select(rows: list[tuple[float, float, int]], start: float, cutoff: float) -> pd.Series:
    targets = pd.DataFrame({"start_time": [h(start)], "cutoff": [h(cutoff)]})
    return select_at_cutoff(forecasts(rows), targets).iloc[0]


def test_run_published_exactly_at_cutoff_is_used() -> None:
    row = select([(0, 30, 100), (10, 30, 200)], start=30, cutoff=10)
    assert row["forecast_mw"] == 200
    assert row["lead_h"] == 20


def test_run_published_after_cutoff_is_ignored() -> None:
    row = select([(0, 30, 100), (10 + 1 / 3600, 30, 200)], start=30, cutoff=10)
    assert row["forecast_mw"] == 100


def test_hindcast_points_are_not_forecasts() -> None:
    # A run published after the target hour also carries that hour; it must not count.
    row = select([(0, 30, 100), (31, 30, 999)], start=30, cutoff=40)
    assert row["forecast_mw"] == 100


def test_falls_back_to_previous_run_when_latest_lacks_target() -> None:
    row = select([(0, 30, 100), (5, 31, 200)], start=30, cutoff=10)
    assert row["forecast_mw"] == 100
    assert row["publish_time"] == h(0)


def test_no_eligible_run_gives_nan() -> None:
    row = select([(20, 30, 100)], start=30, cutoff=10)
    assert pd.isna(row["forecast_mw"])


hours = st.integers(min_value=0, max_value=30)


@settings(max_examples=200, deadline=None)
@given(
    rows=st.lists(st.tuples(hours, hours, st.integers(0, 20000)), max_size=40),
    queries=st.lists(st.tuples(hours, hours), min_size=1, max_size=10),
)
def test_matches_brute_force(
    rows: list[tuple[int, int, int]], queries: list[tuple[int, int]]
) -> None:
    unique = list({(p, s): (p, s, mw) for p, s, mw in rows}.values())
    targets = pd.DataFrame(
        {"start_time": [h(s) for s, _ in queries], "cutoff": [h(c) for _, c in queries]}
    )
    got = select_at_cutoff(forecasts(unique), targets)

    for _, row in got.iterrows():
        start = (row["start_time"] - pd.Timestamp(T0)) / pd.Timedelta(hours=1)
        cutoff = (row["cutoff"] - pd.Timestamp(T0)) / pd.Timedelta(hours=1)
        eligible = [r for r in unique if r[1] == start and r[0] <= cutoff and r[0] < start]
        if not eligible:
            assert pd.isna(row["forecast_mw"])
        else:
            best = max(eligible, key=lambda r: r[0])
            assert row["forecast_mw"] == best[2]
            assert row["publish_time"] == pd.Timestamp(h(best[0]))
