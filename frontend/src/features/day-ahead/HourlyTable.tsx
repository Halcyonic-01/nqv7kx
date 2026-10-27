import type { DayAhead } from '../../lib/api/client'
import { gw, signedGw, ukTime } from '../../lib/format'

export function HourlyTable({ day, adjusted }: { day: DayAhead; adjusted: boolean }) {
  return (
    <details className="group border-t border-hairline pt-3">
      <summary className="cursor-pointer list-none text-[13px] font-medium text-ink-2 hover:text-ink">
        <span className="mr-1.5 inline-block transition-transform group-open:rotate-90">›</span>
        Hourly data
      </summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-right text-[13px] tabular-nums">
          <thead className="text-[12px] text-muted">
            <tr className="border-b border-hairline">
              <th className="py-2 text-left font-normal">Hour (UK)</th>
              <th className="font-normal">Forecast</th>
              <th className="font-normal">Outturn</th>
              <th className="font-normal">Error</th>
              {adjusted && <th className="font-normal">Adjusted</th>}
              <th className="font-normal">P10–P90</th>
            </tr>
          </thead>
          <tbody>
            {day.points.map((p) => (
              <tr key={p.start} className="border-b border-hairline/60 hover:bg-hover">
                <td className="py-1.5 text-left">{ukTime(p.start)}</td>
                <td>{gw(p.forecast_mw)}</td>
                <td>{gw(p.actual_mw)}</td>
                <td>{signedGw(p.error_mw)}</td>
                {adjusted && <td>{gw(p.adjusted_mw)}</td>}
                <td className="text-ink-2">
                  {p.band_low_mw != null && p.band_high_mw != null
                    ? `${(p.band_low_mw / 1000).toFixed(1)}–${(p.band_high_mw / 1000).toFixed(1)}`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
