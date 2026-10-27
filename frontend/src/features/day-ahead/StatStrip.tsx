import type { DayAhead } from '../../lib/api/client'
import { gw, gwh, signedGw, signedPct, ukTime } from '../../lib/format'

type Stat = { label: string; value: string; detail?: string }

function stats(day: DayAhead): Stat[] {
  const s = day.summary
  const delta = s.forecast_gwh != null && s.actual_gwh != null ? s.actual_gwh - s.forecast_gwh : null
  const items: Stat[] = [
    { label: 'Forecast at gate closure', value: gwh(s.forecast_gwh) },
    {
      label: 'Outturn',
      value: gwh(s.actual_gwh),
      detail:
        delta != null && s.forecast_gwh
          ? `${gwh(delta)} vs forecast (${signedPct((delta / s.forecast_gwh) * 100)})`
          : undefined,
    },
    { label: 'Mean absolute error', value: gw(s.mae_mw), detail: `Bias ${signedGw(s.bias_mw)}` },
    {
      label: 'Peak shortfall',
      value: s.max_shortfall_mw != null && s.max_shortfall_mw > 0 ? gw(s.max_shortfall_mw) : 'None',
      detail: s.max_shortfall_at && s.max_shortfall_mw != null && s.max_shortfall_mw > 0 ? `at ${ukTime(s.max_shortfall_at)}` : undefined,
    },
  ]
  if (day.calibration && s.adjusted_mae_mw != null) {
    items.push({
      label: 'Bias-adjusted MAE',
      value: gw(s.adjusted_mae_mw),
      detail: `× ${day.calibration.ratio.toFixed(2)}, trailing ${day.calibration.window_days} days`,
    })
  }
  return items
}

export function StatStrip({ day }: { day: DayAhead }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-y border-hairline py-4 sm:grid-cols-3 lg:grid-flow-col lg:auto-cols-fr lg:grid-cols-none lg:gap-x-0">
      {stats(day).map((s, i) => (
        <div key={s.label} className={i > 0 ? 'lg:border-l lg:border-hairline lg:px-4' : 'lg:pr-4'}>
          <dt className="text-[12px] text-muted">{s.label}</dt>
          <dd className="mt-0.5 text-[22px] font-semibold tracking-tight">{s.value}</dd>
          {s.detail && <dd className="text-[12px] text-ink-2">{s.detail}</dd>}
        </div>
      ))}
    </dl>
  )
}
