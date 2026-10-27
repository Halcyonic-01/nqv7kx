from functools import lru_cache
from typing import Annotated

from fastapi import Depends

from beaufort.config import DATA_DIR
from beaufort.services.analytics import Analytics
from beaufort.store.repository import load_dataset


@lru_cache(maxsize=1)
def get_analytics() -> Analytics:
    return Analytics(load_dataset(DATA_DIR))


AnalyticsDep = Annotated[Analytics, Depends(get_analytics)]
