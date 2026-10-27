import * as Popover from '@radix-ui/react-popover'
import { useState } from 'react'
import { dayLabel } from '../../lib/format'
import { inRange, monthGrid } from '../../lib/time'

type Props = {
  value: string
  first: string
  last: string
  onSelect: (date: string) => void
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const monthName = (y: number, m: number) =>
  new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })

function ym(date: string): [number, number] {
  return [Number(date.slice(0, 4)), Number(date.slice(5, 7))]
}

export function DatePicker({ value, first, last, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => ym(value))
  const [year, month] = view
  const shift = (n: number) => {
    const d = new Date(Date.UTC(year, month - 1 + n, 1))
    setView([d.getUTCFullYear(), d.getUTCMonth() + 1])
  }
  const firstMonth = first.slice(0, 7)
  const lastMonth = last.slice(0, 7)
  const current = `${year}-${String(month).padStart(2, '0')}`

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setView(ym(value))
      }}
    >
      <Popover.Trigger
        className="min-w-[164px] rounded-md px-2.5 py-1 text-left text-[15px] font-semibold tracking-tight hover:bg-hover"
        aria-label={`Delivery day ${dayLabel(value)}. Change`}
      >
        {dayLabel(value)}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[272px] rounded-lg border border-hairline bg-raised p-3 shadow-lg shadow-black/5"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              disabled={current <= firstMonth}
              onClick={() => shift(-1)}
              className="rounded-md px-2 py-0.5 text-ink-2 hover:bg-hover disabled:opacity-30"
            >
              ‹
            </button>
            <span className="text-[13px] font-medium">{monthName(year, month)}</span>
            <button
              type="button"
              aria-label="Next month"
              disabled={current >= lastMonth}
              onClick={() => shift(1)}
              className="rounded-md px-2 py-0.5 text-ink-2 hover:bg-hover disabled:opacity-30"
            >
              ›
            </button>
          </div>
          <table className="w-full text-center text-[12px] tabular-nums">
            <thead>
              <tr>
                {WEEKDAYS.map((d) => (
                  <th key={d} className="pb-1 font-normal text-muted">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthGrid(year, month).map((week, i) => (
                <tr key={i}>
                  {week.map((d, j) => (
                    <td key={j} className="p-0.5">
                      {d && (
                        <button
                          type="button"
                          disabled={!inRange(d, first, last)}
                          aria-current={d === value ? 'date' : undefined}
                          onClick={() => {
                            onSelect(d)
                            setOpen(false)
                          }}
                          className={`size-8 rounded-md disabled:text-muted/50 ${
                            d === value ? 'bg-ink font-semibold text-page' : 'enabled:hover:bg-hover'
                          }`}
                        >
                          {Number(d.slice(8))}
                        </button>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 border-t border-hairline pt-2 text-[12px] text-muted">
            Purchase decisions made in January 2026
          </p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
