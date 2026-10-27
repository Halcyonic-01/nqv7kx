import math
from datetime import date, time, timedelta
from itertools import pairwise
from typing import Any

import numpy as np
import pandas as pd

from beaufort.config import (
    DEFAULT_GATE_CLOSURE,
    DELIVERY_FIRST,
    DELIVERY_LAST,
    GATE_CLOSURES,
    LONDON,
)
from beaufort.domain.calibration import TRAILING, trailing_calibration
from beaufort.domain.metrics import ErrorSummary, error_summary, histogram
from beaufort.domain.selection import select_at_cutoff
from beaufort.domain.time import (
    DELIVERY_DAY_START,
    days,
    delivery_window,
    gate_closure,
    hourly_targets,
)
from beaufort.ingest.quality import EXPECTED_RUN_TIMES_UTC
from beaufort.services import models as m
from beaufort.store.repository import Dataset

LEVEL_EDGES_MW = (0, 4000, 8000, 12000, 16000)


def _mw(x: Any) -> int | None:
    return None if x is None or pd.isna(x) else round(float(x))


def _metrics(s: ErrorSummary | None) -> m.Metrics | None:
    if s is None:
        return None
    return m.Metrics(
        n=s.n,
        mae_mw=round(s.mae_mw),
        rmse_mw=round(s.rmse_mw),
        bias_mw=round(s.bias_mw),
        wape_pct=round(s.wape_pct, 1),
        p50_abs_mw=round(s.p50_abs_mw),
        p90_abs_mw=round(s.p90_abs_mw),
        p99_abs_mw=round(s.p99_abs_mw),
        p10_mw=round(s.p10_mw),
        p90_mw=round(s.p90_mw),
        over_forecast_pct=round(s.over_forecast_pct, 1),
    )


class Analytics:
    """Use cases over an immutable dataset; results cached per parameters."""

    def __init__(
        self, ds: Dataset, first: date = DELIVERY_FIRST, last: date = DELIVERY_LAST
    ) -> None:
        self.ds = ds
        self.first = first
        self.last = last
        self._run_times = pd.DatetimeIndex(ds.forecasts["publish_time"].unique()).sort_values()
        self._pairs: dict[time, pd.DataFrame] = {}
        self._lead: dict[tuple[date, date, int], m.LeadTime] = {}

    @property
    def data_sha256(self) -> str:
        return str(self.ds.manifest["data_sha256"])

    def covers(self, day: date) -> bool:
        return self.first <= day <= self.last

    def pairs(self, gc: time) -> pd.DataFrame:
        """Decision-time forecast vs actual per delivery hour, plus calibration columns."""
        if gc in self._pairs:
            return self._pairs[gc]
        targets = pd.concat(
            [
                pd.DataFrame(
                    {
                        "delivery_date": d,
                        "start_time": hourly_targets(d),
                        "cutoff": gate_closure(d, gc),
                    }
                )
                for d in days(self.first, self.last)
            ],
            ignore_index=True,
        )
        p = select_at_cutoff(self.ds.forecasts, targets)
        actuals = self.ds.actuals.rename(
            columns={"generation_mw": "actual_mw", "publish_time": "actual_publish_time"}
        )
        p = p.merge(actuals, on="start_time", how="left")
        p["error_mw"] = p["forecast_mw"] - p["actual_mw"]

        cal_rows = []
        for d in days(self.first, self.last):
            c = trailing_calibration(p, pd.Timestamp(gate_closure(d, gc)))
            cal_rows.append(
                (d, c.ratio, c.q10, c.q90, c.n) if c else (d, math.nan, math.nan, math.nan, 0)
            )
        cal = pd.DataFrame(cal_rows, columns=["delivery_date", "ratio", "q10", "q90", "cal_n"])
        p = p.merge(cal, on="delivery_date", how="left")
        p["adjusted_mw"] = p["forecast_mw"] * p["ratio"]
        p["band_low_mw"] = p["forecast_mw"] * p["q10"]
        p["band_high_mw"] = p["forecast_mw"] * p["q90"]
        self._pairs[gc] = p
        return p

    def day_ahead(self, day: date, gc: time) -> m.DayAhead:
        rows = self.pairs(gc).query("delivery_date == @day")
        start, end = delivery_window(day)
        cutoff = gate_closure(day, gc)
        a = self.ds.actuals
        hh = a[(a["start_time"] >= start) & (a["start_time"] < end)]

        used = rows.dropna(subset=["publish_time"])
        run_used = (
            m.RunUsed(
                publish_time=used["publish_time"].max(),
                lead_h_min=round(float(used["lead_h"].min()), 1),
                lead_h_max=round(float(used["lead_h"].max()), 1),
            )
            if len(used)
            else None
        )
        later = self._run_times[self._run_times > pd.Timestamp(cutoff)]
        next_run = later[0] if len(later) else None

        first_row = rows.iloc[0] if len(rows) else None
        calibration = (
            m.CalibrationInfo(
                ratio=round(float(first_row["ratio"]), 3),
                q10=round(float(first_row["q10"]), 3),
                q90=round(float(first_row["q90"]), 3),
                n_hours=int(first_row["cal_n"]),
                window_days=TRAILING.days,
            )
            if first_row is not None and not pd.isna(first_row["ratio"])
            else None
        )

        err = rows["error_mw"]
        shortfall_at = rows.loc[err.idxmax(), "start_time"] if err.notna().any() else None
        es = error_summary(rows["forecast_mw"], rows["actual_mw"])
        adj = error_summary(rows["adjusted_mw"], rows["actual_mw"])
        summary = m.DaySummary(
            forecast_gwh=round(rows["forecast_mw"].sum() / 1000, 1) if used.size else None,
            actual_gwh=round(hh["generation_mw"].sum() * 0.5 / 1000, 1) if len(hh) else None,
            mae_mw=_mw(es.mae_mw) if es else None,
            bias_mw=_mw(es.bias_mw) if es else None,
            max_shortfall_mw=_mw(err.max()),
            max_shortfall_at=shortfall_at,
            adjusted_mae_mw=_mw(adj.mae_mw) if adj else None,
        )
        points = [
            m.Point(
                start=r.start_time,
                forecast_mw=_mw(r.forecast_mw),
                actual_mw=_mw(r.actual_mw),
                error_mw=_mw(r.error_mw),
                adjusted_mw=_mw(r.adjusted_mw),
                band_low_mw=_mw(r.band_low_mw),
                band_high_mw=_mw(r.band_high_mw),
            )
            for r in rows.itertuples()
        ]
        return m.DayAhead(
            delivery_date=day,
            window=m.Window(start=start, end=end),
            gate_closure=cutoff,
            run_used=run_used,
            next_run=next_run,
            calibration=calibration,
            summary=summary,
            points=points,
            actuals_hh=[
                m.ActualPoint(start=r.start_time, actual_mw=int(r.generation_mw))
                for r in hh.itertuples()
            ],
        )

    def runs(self, day: date, gc: time) -> m.DayRuns:
        """Every run with a forecast for this day, from 48 h before the window."""
        start, end = delivery_window(day)
        cutoff = gate_closure(day, gc)
        f = self.ds.forecasts
        sel = f[
            (f["start_time"] >= start)
            & (f["start_time"] < end)
            & (f["publish_time"] < f["start_time"])
            & (f["publish_time"] >= start - timedelta(hours=48))
        ].sort_values(["publish_time", "start_time"])
        runs = [
            m.RunSeries(
                publish_time=pt,
                available_at_gate_closure=pt <= cutoff,
                points=[
                    m.RunPoint(start=s, mw=int(v))
                    for s, v in zip(g["start_time"], g["generation_mw"], strict=True)
                ],
            )
            for pt, g in sel.groupby("publish_time", sort=True)
        ]
        return m.DayRuns(delivery_date=day, gate_closure=cutoff, runs=runs)

    def accuracy(self, first: date, last: date, gc: time) -> m.Accuracy:
        p = self.pairs(gc).query("@first <= delivery_date <= @last")
        valid = p.dropna(subset=["forecast_mw", "actual_mw"])

        both = valid.dropna(subset=["adjusted_mw"])
        raw_s = error_summary(both["forecast_mw"], both["actual_mw"])
        adj_s = error_summary(both["adjusted_mw"], both["actual_mw"])
        adjusted = (
            m.AdjustedComparison(
                n=raw_s.n,
                raw_mae_mw=round(raw_s.mae_mw),
                adjusted_mae_mw=round(adj_s.mae_mw),
                raw_bias_mw=round(raw_s.bias_mw),
                adjusted_bias_mw=round(adj_s.bias_mw),
            )
            if raw_s and adj_s
            else None
        )

        daily = []
        for d, g in valid.groupby("delivery_date", sort=True):
            daily.append(
                m.DailyRow(
                    delivery_date=d,
                    n=len(g),
                    mae_mw=round(g["error_mw"].abs().mean()),
                    bias_mw=round(g["error_mw"].mean()),
                    forecast_gwh=round(g["forecast_mw"].sum() / 1000, 1),
                    actual_gwh=round(g["actual_mw"].sum() / 1000, 1),
                )
            )

        # Local hours in delivery-day order: 23, 0, 1, ... 22.
        hours = valid["start_time"].dt.tz_convert(LONDON).dt.hour
        start_h = DELIVERY_DAY_START.hour
        by_hour = []
        for h in [(start_h + i) % 24 for i in range(24)]:
            g = valid[hours == h]
            if len(g):
                by_hour.append(
                    m.HourRow(
                        hour=h,
                        n=len(g),
                        mae_mw=round(g["error_mw"].abs().mean()),
                        bias_mw=round(g["error_mw"].mean()),
                    )
                )

        by_level = []
        edges = [*LEVEL_EDGES_MW, None]
        for lo, hi in pairwise(edges):
            assert lo is not None
            in_bin = valid["forecast_mw"] >= lo
            if hi is not None:
                in_bin &= valid["forecast_mw"] < hi
            g = valid[in_bin]
            if len(g):
                label = f"{lo // 1000}–{hi // 1000} GW" if hi is not None else f"≥{lo // 1000} GW"
                by_level.append(
                    m.LevelRow(
                        label=label,
                        lo_mw=lo,
                        hi_mw=hi,
                        n=len(g),
                        mae_mw=round(g["error_mw"].abs().mean()),
                        bias_mw=round(g["error_mw"].mean()),
                        actual_to_forecast=round(g["actual_mw"].sum() / g["forecast_mw"].sum(), 3),
                    )
                )

        edges_mw, counts = histogram(valid["error_mw"])
        lead = (
            m.LeadRange(
                min=round(float(valid["lead_h"].min()), 1),
                max=round(float(valid["lead_h"].max()), 1),
            )
            if len(valid)
            else None
        )
        return m.Accuracy(
            first=first,
            last=last,
            metrics=_metrics(error_summary(valid["forecast_mw"], valid["actual_mw"])),
            adjusted=adjusted,
            decision_lead_h=lead,
            daily=daily,
            by_hour=by_hour,
            by_forecast_level=by_level,
            histogram=m.Histogram(edges_mw=edges_mw, counts=counts),
        )

    def lead_time(self, first: date, last: date, max_h: int = 48) -> m.LeadTime:
        """Error vs horizon H: latest run published at least H hours before each target."""
        key = (first, last, max_h)
        if key in self._lead:
            return self._lead[key]
        starts = pd.DatetimeIndex(np.concatenate([hourly_targets(d) for d in days(first, last)]))
        targets = pd.concat(
            [
                pd.DataFrame(
                    {"start_time": starts, "cutoff": starts - pd.Timedelta(hours=h), "horizon_h": h}
                )
                for h in range(max_h + 1)
            ],
            ignore_index=True,
        )
        sel = select_at_cutoff(self.ds.forecasts, targets).merge(
            self.ds.actuals[["start_time", "generation_mw"]].rename(
                columns={"generation_mw": "actual_mw"}
            ),
            on="start_time",
            how="left",
        )
        sel = sel.dropna(subset=["forecast_mw", "actual_mw"])
        rows = []
        for h, g in sel.groupby("horizon_h", sort=True):
            s = error_summary(g["forecast_mw"], g["actual_mw"])
            assert s is not None
            rows.append(
                m.LeadTimeRow(
                    horizon_h=int(h),
                    n=s.n,
                    mae_mw=round(s.mae_mw),
                    bias_mw=round(s.bias_mw),
                    p10_mw=round(s.p10_mw),
                    p90_mw=round(s.p90_mw),
                    effective_lead_h=round(float(g["lead_h"].mean()), 1),
                )
            )
        result = m.LeadTime(first=first, last=last, rows=rows)
        self._lead[key] = result
        return result

    def meta(self) -> m.Meta:
        manifest = self.ds.manifest
        return m.Meta(
            coverage=m.Coverage(first=self.first, last=self.last),
            gate_closures=[m.Preset(id=g.id, label=g.label, time=g.time) for g in GATE_CLOSURES],
            default_gate_closure=DEFAULT_GATE_CLOSURE,
            delivery_day_start=DELIVERY_DAY_START.strftime("%H:%M"),
            timezone="Europe/London",
            run_schedule_utc=list(EXPECTED_RUN_TIMES_UTC),
            snapshot=m.Snapshot(
                generated_at=manifest["generated_at"],
                data_sha256=manifest["data_sha256"],
                rows=manifest["rows"],
                quality=manifest["quality"],
            ),
        )
