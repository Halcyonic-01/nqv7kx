from datetime import date, time
from typing import Annotated

from fastapi import APIRouter, Query

from beaufort.api.deps import AnalyticsDep
from beaufort.api.errors import ProblemError
from beaufort.config import DEFAULT_GATE_CLOSURE
from beaufort.domain.time import DELIVERY_DAY_START, parse_hhmm
from beaufort.services import models as m
from beaufort.services.analytics import Analytics

router = APIRouter(tags=["analytics"])

GateClosure = Annotated[
    str,
    Query(pattern=r"^([01]\d|2[0-3]):[0-5]\d$", description="UK local time on D-1, HH:MM"),
]
From = Annotated[date | None, Query(alias="from")]
To = Annotated[date | None, Query(alias="to")]


def _gate_closure(value: str) -> time:
    at = parse_hhmm(value)
    if at >= DELIVERY_DAY_START:
        start = DELIVERY_DAY_START.strftime("%H:%M")
        raise ProblemError(
            422, "Invalid gate closure", f"Gate closure must be before {start} on D-1"
        )
    return at


def _check_day(a: Analytics, day: date) -> None:
    if not a.covers(day):
        raise ProblemError(422, "Out of coverage", f"Delivery days run {a.first} to {a.last}")


def _range(a: Analytics, first: date | None, last: date | None) -> tuple[date, date]:
    first, last = first or a.first, last or a.last
    _check_day(a, first)
    _check_day(a, last)
    if first > last:
        raise ProblemError(422, "Invalid range", "`from` must not be after `to`")
    return first, last


@router.get("/meta")
def meta(a: AnalyticsDep) -> m.Meta:
    return a.meta()


@router.get("/day-ahead")
def day_ahead(
    a: AnalyticsDep, delivery_date: date, gate_closure: GateClosure = DEFAULT_GATE_CLOSURE
) -> m.DayAhead:
    _check_day(a, delivery_date)
    return a.day_ahead(delivery_date, _gate_closure(gate_closure))


@router.get("/day-ahead/runs")
def day_ahead_runs(
    a: AnalyticsDep, delivery_date: date, gate_closure: GateClosure = DEFAULT_GATE_CLOSURE
) -> m.DayRuns:
    _check_day(a, delivery_date)
    return a.runs(delivery_date, _gate_closure(gate_closure))


@router.get("/accuracy")
def accuracy(
    a: AnalyticsDep,
    first: From = None,
    last: To = None,
    gate_closure: GateClosure = DEFAULT_GATE_CLOSURE,
) -> m.Accuracy:
    return a.accuracy(*_range(a, first, last), _gate_closure(gate_closure))


@router.get("/accuracy/lead-time")
def lead_time(
    a: AnalyticsDep,
    first: From = None,
    last: To = None,
    max_h: Annotated[int, Query(ge=0, le=60)] = 48,
) -> m.LeadTime:
    return a.lead_time(*_range(a, first, last), max_h)
