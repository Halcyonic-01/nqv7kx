import type { DayAhead } from '../../lib/api/client'
import { hours, ukDayTime, ukTime } from '../../lib/format'
import { addDays } from '../../lib/time'
import { DatePicker } from './DatePicker'

type Props = {
  date: string
  first: string
  last: string
  day: DayAhead | undefined
  onSelect: (date: string) => void
}

function Step({ dir, disabled, onClick }: { dir: 'prev' | 'next'; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={dir === 'prev' ? 'Previous delivery day' : 'Next delivery day'}
      aria-keyshortcuts={dir === 'prev' ? 'ArrowLeft' : 'ArrowRight'}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-md border border-hairline text-ink-2 hover:bg-hover disabled:opacity-30"
    >
      {dir === 'prev' ? '‹' : '›'}
    </button>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular-nums text-ink">{value}</dd>
    </div>
  )
}

export function DayContextBar({ date, first, last, day, onSelect }: Props) {
  const run = day?.run_used
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex items-center gap-1.5">
        <Step dir="prev" disabled={date <= first} onClick={() => onSelect(addDays(date, -1))} />
        <DatePicker value={date} first={first} last={last} onSelect={onSelect} />
        <Step dir="next" disabled={date >= last} onClick={() => onSelect(addDays(date, 1))} />
      </div>
      {day && (
        <dl className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[13px]">
          <Fact label="Gate closure" value={ukDayTime(day.gate_closure)} />
          {run && <Fact label="Run" value={ukTime(run.publish_time)} />}
          {run && <Fact label="Lead" value={`${hours(run.lead_h_min)}–${hours(run.lead_h_max)} h`} />}
          {day.next_run && <Fact label="Next run" value={`${ukTime(day.next_run)}, after gate closure`} />}
        </dl>
      )}
    </div>
  )
}
