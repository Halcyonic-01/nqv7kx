import json
import sqlite3
from contextlib import closing
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd

from beaufort.config import DB_FILENAME, MANIFEST_FILENAME
from beaufort.domain.time import TS_DTYPE


@dataclass(frozen=True)
class Dataset:
    forecasts: pd.DataFrame  # publish_time, start_time, generation_mw
    actuals: pd.DataFrame  # start_time, generation_mw, publish_time
    manifest: dict[str, Any]


def _utc(seconds: pd.Series) -> pd.Series:
    return pd.to_datetime(seconds, unit="s", utc=True).astype(TS_DTYPE)


def load_dataset(data_dir: Path) -> Dataset:
    uri = f"{(data_dir / DB_FILENAME).resolve().as_uri()}?mode=ro"
    with closing(sqlite3.connect(uri, uri=True)) as conn:
        forecasts = pd.read_sql_query(
            "SELECT publish_time, start_time, generation_mw FROM wind_forecast", conn
        )
        actuals = pd.read_sql_query(
            "SELECT start_time, generation_mw, publish_time FROM wind_actual ORDER BY start_time",
            conn,
        )
    for frame in (forecasts, actuals):
        frame["publish_time"] = _utc(frame["publish_time"])
        frame["start_time"] = _utc(frame["start_time"])
    manifest = json.loads((data_dir / MANIFEST_FILENAME).read_text())
    return Dataset(forecasts=forecasts, actuals=actuals, manifest=manifest)
