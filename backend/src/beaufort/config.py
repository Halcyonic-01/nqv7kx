import os
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ELEXON_BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"
LONDON = ZoneInfo("Europe/London")

_REPO_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = Path(os.environ.get("BEAUFORT_DATA_DIR", _REPO_ROOT / "data"))
DB_FILENAME = "beaufort.sqlite"
MANIFEST_FILENAME = "manifest.json"


@dataclass(frozen=True)
class IngestWindow:
    forecast_publish_from: datetime
    forecast_publish_to: datetime
    actual_date_from: date
    actual_date_to: date


# Decisions 1-31 Jan 2026, plus margin for delivery 1-31 Jan.
DEFAULT_WINDOW = IngestWindow(
    forecast_publish_from=datetime(2025, 12, 29, tzinfo=UTC),
    forecast_publish_to=datetime(2026, 2, 2, tzinfo=UTC),
    actual_date_from=date(2025, 12, 31),
    actual_date_to=date(2026, 2, 2),
)
