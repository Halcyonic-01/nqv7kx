# Methodology

## Question being answered

A GB day-ahead buyer commits before gate closure on D−1. To decide how much non-wind power to buy, they need two things:
1. the wind forecast they could actually see at that moment;
2. how wrong that forecast tends to be.

## Data

| Dataset | Endpoint | Used fields |
|---|---|---|
| Forecast: WINDFOR | `/datasets/WINDFOR/stream?publishDateTimeFrom&publishDateTimeTo` | `publishTime`, `startTime`, `generation` (MW) |
| Outturn: FUELHH, `fuelType=WIND` | `/datasets/FUELHH/stream?settlementDateFrom&settlementDateTo&fuelType=WIND` | `startTime`, `settlementDate`, `settlementPeriod`, `generation` (MW), `publishTime` |

Base URL: `https://data.elexon.co.uk/bmrs/api/v1`. No other data is used.

### What the data actually looks like (versus the documentation)

- **Runs:** WINDFOR has **8 runs per day** (02:30, 04:30, 07:30, 09:30, 11:30, 15:30, 18:30, 22:30 UTC). Elexon's glossary describes 4 half-hourly runs.
- **Resolution:** each run has **73 hourly points**, from 21:00 D−1 to 21:00 D+2. Points before `publishTime` are included; they are hindcasts, not forecasts, and are excluded.
- **Late runs:** one January run was published late (15 Jan 12:25 instead of 11:30). The ingest flags off-schedule runs and never assumes a fixed timetable.
- **Outturn:** FUELHH is half-hourly and complete for the window: 1,632 of 1,632 periods.

## Definitions

| Term | Definition |
|---|---|
| Delivery day D | 23:00 D−1 to 23:00 D, UK local. This is the GB day-ahead auction day and the EFA day: 24 hourly targets, or 23/25 on clock-change days |
| Gate closure | 09:20 UK on D−1 for the EPEX GB 60-min auction (default); 09:50 for N2EX. Any HH:MM before 23:00 is accepted, since a later cutoff would fall inside the delivery day |
| Window | Decisions made 1–31 Jan 2026, so delivery days 2 Jan to 1 Feb 2026 |
| Forecast used for hour T | The WINDFOR point for `startTime = T` from the latest run with `publishTime ≤ gate closure` **and** `publishTime < T` |
| Lead time | T − `publishTime` of that run. At 09:20 it is 15.5–38.5 h (the 07:30 run); at 09:50 it is 13.5–36.5 h (the 09:30 run) |
| Outturn for hour T | The FUELHH half-hour starting at T |
| Error e | forecast − outturn. Positive means over-forecast: less wind than planned, a shortfall to cover |

Selection is a single `pandas.merge_asof` (`by=startTime`, `left_on=cutoff`, `right_on=publishTime`, `direction="backward"`) on rows pre-filtered to positive lead times. If the latest run lacks a target hour, the previous run's value is used. A property test checks the result against brute force.

### Alignment check

Comparing the hourly forecast to the on-the-hour half-hour, versus the mean of both half-hours, changes MAE by under 1% (1,932 vs 1,948 MW at H ≥ 24 h). The simpler join is used. Charts still show the full half-hourly outturn.

## Metrics

| Metric | Formula | Why |
|---|---|---|
| MAE | mean \|e\| | Typical size of a miss, in MW |
| RMSE | √mean e² | Penalises the large misses that drive imbalance cost |
| Bias | mean e | Systematic over- or under-forecasting |
| WAPE | Σ\|e\| / Σ outturn | Scale-free error. **MAPE is not used:** it explodes at low wind |
| P50/P90/P99 \|e\| | Quantiles of \|e\| | Tail risk; P90 is a natural hedge-sizing number |
| P10/P90 e | Signed quantiles | Asymmetric spread, since errors are skewed |
| Over-forecast share | share of hours with e > 0 | How often the forecast is too high |

**Lead-time curve:** for H = 0…48 h, each target uses the latest run published at least H hours before it. The curve reports the metrics per H and the mean effective lead. Because there are 8 runs a day, the effective lead is always ≥ H.

## Bias-adjusted forecast and range

For delivery day D with cutoff C:
1. Take the decision-time (forecast, outturn) pairs of the previous **7 days** whose outturn was **published by C**. This means no look-ahead, and a test injects a post-cutoff sentinel value to prove it.
2. Ratio r = Σ outturn / Σ forecast. Adjusted forecast = r × forecast.
3. The range is forecast × [q10, q90] of the hourly outturn/forecast ratios in the same window. It is multiplicative because the error grows with wind level.
4. Fewer than 72 hours of history gives no adjustment; the first four delivery days are warm-up.

The adjustment is shown **next to** the official forecast and never replaces it.

## January 2026 results (09:20 gate closure)

These are pinned in `backend/tests/services/test_golden.py`.

| | Value |
|---|---|
| Hours / days | 744 / 31 |
| MAE · RMSE | 2.02 GW · 2.49 GW |
| Bias | **+1.75 GW**, over-forecast in **85%** of hours |
| P50 / P90 / P99 \|e\| | 1.66 / 4.15 / 6.19 GW |
| WAPE | 17.9% |
| N2EX (09:30 run) | MAE 1.99 GW (−1.4%) |
| Lead time 0 h → 24 h → 48 h | MAE 1.68 → 1.94 → 2.30 GW |
| Bias by forecast level | +0.27 GW at 4–8 GW; **+2.82 GW above 16 GW** (outturn ≈ 85% of forecast) |
| Bias-adjusted (648 h) | MAE 2.03 → **1.33 GW (−35%)**, bias +1.77 → +0.26 GW |
| Worst days | 28 Jan (5.29 GW), 12 Jan (5.03), 11 Jan (4.74) |

What the numbers say:
1. **Most of the error is bias, not noise.** The forecast overstates delivered wind, and more so at high wind. This is *consistent with* curtailment/constraint actions and/or a scope difference between the two datasets. It cannot be confirmed from Elexon wind data alone, which is the brief's limit.
2. **Waiting for a later run barely helps.** Bidding on N2EX instead of EPEX improves MAE by about 1%.
3. **A transparent trailing correction cuts error by about a third** using only information available at gate closure. It can hurt on days where the bias flips (for example 19 Jan), which is why the official forecast stays visible.

## Assumptions and limits

- **Availability:** `publishTime` is treated as the moment a run becomes usable, so dissemination lag is not modelled.
- **Comparable fleets:** FUELHH `WIND` and WINDFOR are treated as comparable national fleets (see point 1 above).
- **In-window history:** the adjustment and range use trailing data inside the snapshot only. A production version would keep a rolling history.
- **Delivery-day convention:** 23:00–23:00 is the default; the settlement day (00:00–24:00) is the alternative.
