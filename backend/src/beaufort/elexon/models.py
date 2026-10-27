from datetime import date
from typing import Any, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, ValidationError, field_validator


class _Row(BaseModel):
    model_config = ConfigDict(frozen=True, populate_by_name=True)

    publish_time: AwareDatetime = Field(alias="publishTime")
    start_time: AwareDatetime = Field(alias="startTime")
    generation_mw: int = Field(alias="generation", ge=0)

    @field_validator("generation_mw", mode="before")
    @classmethod
    def _round_mw(cls, v: Any) -> Any:
        return round(v) if isinstance(v, float) else v


class ForecastRow(_Row):
    """WINDFOR point: one run's forecast for one hour."""


class ActualRow(_Row):
    """FUELHH WIND outturn for one settlement period."""

    settlement_date: date = Field(alias="settlementDate")
    settlement_period: int = Field(alias="settlementPeriod", ge=1, le=50)
    fuel_type: Literal["WIND"] = Field(alias="fuelType")


def parse_rows[T: _Row](model: type[T], raw: list[dict[str, Any]]) -> tuple[list[T], int]:
    """Validate rows; returns (valid, rejected count)."""
    valid: list[T] = []
    rejected = 0
    for item in raw:
        try:
            valid.append(model.model_validate(item))
        except ValidationError:
            rejected += 1
    return valid, rejected
