"""January 2026 figures on the committed snapshot (see README)."""

from datetime import UTC, date, datetime, time

import pytest

from beaufort.config import DATA_DIR, DELIVERY_FIRST, DELIVERY_LAST
from beaufort.services.analytics import Analytics
from beaufort.store.repository import load_dataset

EPEX, N2EX = time(9, 20), time(9, 50)


@pytest.fixture(scope="module")
def analytics() -> Analytics:
    return Analytics(load_dataset(DATA_DIR))


def test_epex_accuracy(analytics: Analytics) -> None:
    acc = analytics.accuracy(DELIVERY_FIRST, DELIVERY_LAST, EPEX)
    assert acc.metrics is not None
    m = acc.metrics
    assert (m.n, m.mae_mw, m.rmse_mw, m.bias_mw) == (744, 2019, 2491, 1747)
    assert (m.p50_abs_mw, m.p90_abs_mw, m.p99_abs_mw) == (1656, 4146, 6194)
    assert (m.p10_mw, m.p90_mw) == (-417, 4146)
    assert (m.wape_pct, m.over_forecast_pct) == (17.9, 84.9)
    assert acc.decision_lead_h is not None
    assert (acc.decision_lead_h.min, acc.decision_lead_h.max) == (15.5, 38.5)


def test_n2ex_uses_later_run_and_is_slightly_better(analytics: Analytics) -> None:
    acc = analytics.accuracy(DELIVERY_FIRST, DELIVERY_LAST, N2EX)
    assert acc.metrics is not None
    assert acc.metrics.mae_mw == 1991
    assert acc.decision_lead_h is not None
    assert acc.decision_lead_h.min == 13.5


def test_bias_adjustment_cuts_error(analytics: Analytics) -> None:
    adj = analytics.accuracy(DELIVERY_FIRST, DELIVERY_LAST, EPEX).adjusted
    assert adj is not None
    assert (adj.n, adj.raw_mae_mw, adj.adjusted_mae_mw) == (648, 2034, 1332)
    assert adj.adjusted_bias_mw == 255


def test_worst_days_and_level_bias(analytics: Analytics) -> None:
    acc = analytics.accuracy(DELIVERY_FIRST, DELIVERY_LAST, EPEX)
    worst = sorted(acc.daily, key=lambda r: -r.mae_mw)[:3]
    assert [(r.delivery_date.day, r.mae_mw) for r in worst] == [(28, 5286), (12, 5026), (11, 4735)]
    top = acc.by_forecast_level[-1]
    assert (top.label, top.bias_mw, top.actual_to_forecast) == ("≥16 GW", 2819, 0.847)


def test_day_ahead_uses_0730_run(analytics: Analytics) -> None:
    day = analytics.day_ahead(date(2026, 1, 12), EPEX)
    assert day.run_used is not None
    assert day.run_used.publish_time == datetime(2026, 1, 11, 7, 30, tzinfo=UTC)
    assert (day.run_used.lead_h_min, day.run_used.lead_h_max) == (15.5, 38.5)
    assert day.next_run == datetime(2026, 1, 11, 9, 30, tzinfo=UTC)
    assert (len(day.points), len(day.actuals_hh)) == (24, 48)
    assert day.summary.mae_mw == 5026


def test_runs_flag_availability(analytics: Analytics) -> None:
    runs = analytics.runs(date(2026, 1, 12), EPEX).runs
    available = [r.publish_time for r in runs if r.available_at_gate_closure]
    assert max(available) == datetime(2026, 1, 11, 7, 30, tzinfo=UTC)
    assert any(not r.available_at_gate_closure for r in runs)


def test_lead_time_curve(analytics: Analytics) -> None:
    rows = {r.horizon_h: r for r in analytics.lead_time(DELIVERY_FIRST, DELIVERY_LAST).rows}
    assert (rows[0].mae_mw, rows[24].mae_mw, rows[48].mae_mw) == (1684, 1937, 2301)
    assert rows[48].n == 589


def test_daily_energy_matches_day_ahead_summary(analytics: Analytics) -> None:
    acc = analytics.accuracy(date(2026, 1, 28), date(2026, 1, 28), EPEX)
    day = analytics.day_ahead(date(2026, 1, 28), EPEX)
    assert acc.daily[0].actual_gwh == day.summary.actual_gwh == 142.5
    assert acc.daily[0].forecast_gwh == day.summary.forecast_gwh == 270.8
