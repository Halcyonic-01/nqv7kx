import hashlib
import sqlite3
from collections.abc import Iterable
from pathlib import Path

from beaufort.elexon.models import ActualRow, ForecastRow

# Timestamps are UTC epoch seconds.
SCHEMA = """
CREATE TABLE IF NOT EXISTS wind_forecast (
    publish_time  INTEGER NOT NULL,
    start_time    INTEGER NOT NULL,
    generation_mw INTEGER NOT NULL,
    PRIMARY KEY (publish_time, start_time)
);
CREATE INDEX IF NOT EXISTS ix_forecast_start ON wind_forecast (start_time, publish_time);

CREATE TABLE IF NOT EXISTS wind_actual (
    start_time        INTEGER PRIMARY KEY,
    settlement_date   TEXT    NOT NULL,
    settlement_period INTEGER NOT NULL,
    generation_mw     INTEGER NOT NULL,
    publish_time      INTEGER NOT NULL
);
"""


def connect(path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.executescript(SCHEMA)
    return conn


def upsert_forecasts(conn: sqlite3.Connection, rows: Iterable[ForecastRow]) -> None:
    conn.executemany(
        """
        INSERT INTO wind_forecast (publish_time, start_time, generation_mw) VALUES (?, ?, ?)
        ON CONFLICT (publish_time, start_time) DO UPDATE SET generation_mw = excluded.generation_mw
        """,
        (
            (int(r.publish_time.timestamp()), int(r.start_time.timestamp()), r.generation_mw)
            for r in rows
        ),
    )


def upsert_actuals(conn: sqlite3.Connection, rows: Iterable[ActualRow]) -> None:
    # Keep the most recently published value per period.
    conn.executemany(
        """
        INSERT INTO wind_actual
            (start_time, settlement_date, settlement_period, generation_mw, publish_time)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (start_time) DO UPDATE SET
            settlement_date = excluded.settlement_date,
            settlement_period = excluded.settlement_period,
            generation_mw = excluded.generation_mw,
            publish_time = excluded.publish_time
        WHERE excluded.publish_time >= wind_actual.publish_time
        """,
        (
            (
                int(r.start_time.timestamp()),
                r.settlement_date.isoformat(),
                r.settlement_period,
                r.generation_mw,
                int(r.publish_time.timestamp()),
            )
            for r in rows
        ),
    )


def row_counts(conn: sqlite3.Connection) -> dict[str, int]:
    return {
        table: conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        for table in ("wind_forecast", "wind_actual")
    }


def content_sha256(conn: sqlite3.Connection) -> str:
    """Hash of the data itself, stable across rebuilds (unlike the file bytes)."""
    digest = hashlib.sha256()
    queries = (
        "SELECT publish_time, start_time, generation_mw FROM wind_forecast"
        " ORDER BY publish_time, start_time",
        "SELECT start_time, settlement_date, settlement_period, generation_mw, publish_time"
        " FROM wind_actual ORDER BY start_time",
    )
    for query in queries:
        for row in conn.execute(query):
            digest.update(("|".join(map(str, row)) + "\n").encode())
    return digest.hexdigest()
