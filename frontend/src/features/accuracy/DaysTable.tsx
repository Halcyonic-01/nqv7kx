import { Link } from 'react-router'
import type { Accuracy } from '../../lib/api/client'
import { dayLabel, gw, gwh, signedGw } from '../../lib/format'

type Day = Accuracy['daily'][number]

function Rows({ days, search }: { days: Day[]; search: string }) {
  return (
    <table className="w-full text-right text-[13px] tabular-nums">
      <thead className="text-[12px] text-muted">
        <tr className="border-b border-hairline">
          <th className="py-2 text-left font-normal">Delivery day</th>
          <th className="font-normal">MAE</th>
          <th className="font-normal">Bias</th>
          <th className="hidden font-normal sm:table-cell">Forecast</th>
          <th className="hidden font-normal sm:table-cell">Outturn</th>
        </tr>
      </thead>
      <tbody>
        {days.map((d) => (
          <tr key={d.delivery_date} className="border-b border-hairline/60 hover:bg-hover">
            <td className="py-1.5 text-left">
              <Link to={`/day-ahead/${d.delivery_date}${search}`} className="underline-offset-2 hover:underline">
                {dayLabel(d.delivery_date)}
              </Link>
            </td>
            <td>{gw(d.mae_mw)}</td>
            <td>{signedGw(d.bias_mw)}</td>
            <td className="hidden sm:table-cell">{gwh(d.forecast_gwh)}</td>
            <td className="hidden sm:table-cell">{gwh(d.actual_gwh)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function WorstDays({ days, search }: { days: Day[]; search: string }) {
  const worst = [...days].sort((a, b) => b.mae_mw - a.mae_mw).slice(0, 6)
  return <Rows days={worst} search={search} />
}

export function DailyTable({ days, search }: { days: Day[]; search: string }) {
  return (
    <details className="group border-t border-hairline pt-3">
      <summary className="cursor-pointer list-none text-[13px] font-medium text-ink-2 hover:text-ink">
        <span className="mr-1.5 inline-block transition-transform group-open:rotate-90">›</span>
        Daily data
      </summary>
      <div className="mt-3">
        <Rows days={days} search={search} />
      </div>
    </details>
  )
}
