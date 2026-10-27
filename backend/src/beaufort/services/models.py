"""Response models: MW as integers, timestamps in UTC."""

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class _Model(BaseModel):
    model_config = ConfigDict(frozen=True)


class Window(_Model):
    start: datetime
    end: datetime


class RunUsed(_Model):
    publish_time: datetime
    lead_h_min: float
    lead_h_max: float


class CalibrationInfo(_Model):
    ratio: float
    q10: float
    q90: float
    n_hours: int
    window_days: int


class Metrics(_Model):
    n: int
    mae_mw: int
    rmse_mw: int
    bias_mw: int
    wape_pct: float
    p50_abs_mw: int
    p90_abs_mw: int
    p99_abs_mw: int
    p10_mw: int
    p90_mw: int
    over_forecast_pct: float


class Point(_Model):
    start: datetime
    forecast_mw: int | None
    actual_mw: int | None
    error_mw: int | None
    adjusted_mw: int | None
    band_low_mw: int | None
    band_high_mw: int | None


class ActualPoint(_Model):
    start: datetime
    actual_mw: int


class DaySummary(_Model):
    forecast_gwh: float | None
    actual_gwh: float | None
    mae_mw: int | None
    bias_mw: int | None
    max_shortfall_mw: int | None
    max_shortfall_at: datetime | None
    adjusted_mae_mw: int | None


class DayAhead(_Model):
    delivery_date: date
    window: Window
    gate_closure: datetime
    run_used: RunUsed | None
    next_run: datetime | None
    calibration: CalibrationInfo | None
    summary: DaySummary
    points: list[Point]
    actuals_hh: list[ActualPoint]


class RunPoint(_Model):
    start: datetime
    mw: int


class RunSeries(_Model):
    publish_time: datetime
    available_at_gate_closure: bool
    points: list[RunPoint]


class DayRuns(_Model):
    delivery_date: date
    gate_closure: datetime
    runs: list[RunSeries]


class AdjustedComparison(_Model):
    n: int
    raw_mae_mw: int
    adjusted_mae_mw: int
    raw_bias_mw: int
    adjusted_bias_mw: int


class LeadRange(_Model):
    min: float
    max: float


class DailyRow(_Model):
    delivery_date: date
    n: int
    mae_mw: int
    bias_mw: int
    forecast_gwh: float
    actual_gwh: float


class HourRow(_Model):
    hour: int
    n: int
    mae_mw: int
    bias_mw: int


class LevelRow(_Model):
    label: str
    lo_mw: int
    hi_mw: int | None
    n: int
    mae_mw: int
    bias_mw: int
    actual_to_forecast: float


class Histogram(_Model):
    edges_mw: list[int]
    counts: list[int]


class Accuracy(_Model):
    first: date
    last: date
    metrics: Metrics | None
    adjusted: AdjustedComparison | None
    decision_lead_h: LeadRange | None
    daily: list[DailyRow]
    by_hour: list[HourRow]
    by_forecast_level: list[LevelRow]
    histogram: Histogram


class LeadTimeRow(_Model):
    horizon_h: int
    n: int
    mae_mw: int
    bias_mw: int
    p10_mw: int
    p90_mw: int
    effective_lead_h: float


class LeadTime(_Model):
    first: date
    last: date
    rows: list[LeadTimeRow]


class Coverage(_Model):
    first: date
    last: date


class Preset(_Model):
    id: str
    label: str
    time: str


class Snapshot(_Model):
    generated_at: datetime
    data_sha256: str
    rows: dict[str, int]
    quality: dict[str, Any]


class Meta(_Model):
    coverage: Coverage
    gate_closures: list[Preset]
    default_gate_closure: str
    delivery_day_start: str
    timezone: str
    run_schedule_utc: list[str]
    snapshot: Snapshot
