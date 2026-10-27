import pandas as pd

from beaufort.domain.time import TS_DTYPE


def select_at_cutoff(forecasts: pd.DataFrame, targets: pd.DataFrame) -> pd.DataFrame:
    """Latest forecast per target with publish_time <= cutoff and publish_time < start_time.

    forecasts: publish_time, start_time, generation_mw.
    targets: start_time, cutoff (+ any passthrough columns).
    Adds publish_time, forecast_mw, lead_h (NaN when nothing qualifies).
    """
    eligible = forecasts.loc[
        forecasts["publish_time"] < forecasts["start_time"],
        ["publish_time", "start_time", "generation_mw"],
    ].astype({"publish_time": TS_DTYPE, "start_time": TS_DTYPE, "generation_mw": "float64"})
    left = targets.astype({"start_time": TS_DTYPE, "cutoff": TS_DTYPE}).sort_values("cutoff")

    picked = pd.merge_asof(
        left,
        eligible.sort_values("publish_time"),
        left_on="cutoff",
        right_on="publish_time",
        by="start_time",
        direction="backward",
        allow_exact_matches=True,
    ).rename(columns={"generation_mw": "forecast_mw"})
    picked["lead_h"] = (picked["start_time"] - picked["publish_time"]).dt.total_seconds() / 3600
    return picked.sort_values(["start_time", "cutoff"], kind="stable").reset_index(drop=True)
