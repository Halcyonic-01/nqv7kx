import * as Popover from '@radix-ui/react-popover'
import { useMeta } from '../lib/api/queries'
import { ukDayTime } from '../lib/format'

export function DataPopover() {
  const { data: meta } = useMeta()
  const snap = meta?.snapshot
  const offSchedule = (snap?.quality.forecasts as { off_schedule_runs?: string[] } | undefined)?.off_schedule_runs ?? []

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label="Data and method"
        className="grid place-items-center rounded-md px-1.5 py-1 text-[13px] text-ink-2 hover:bg-hover hover:text-ink sm:px-2.5"
      >
        <span className="hidden sm:inline">Data &amp; method</span>
        <svg viewBox="0 0 16 16" className="size-4 sm:hidden" aria-hidden>
          <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 7.2v3.8M8 5v.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[min(380px,calc(100vw-32px))] rounded-lg border border-hairline bg-raised p-4 text-[13px] leading-relaxed shadow-lg shadow-black/5"
        >
          <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-2.5">
            <dt className="text-muted">Source</dt>
            <dd>Elexon BMRS · WINDFOR forecasts, FUELHH wind outturn (national)</dd>
            <dt className="text-muted">Delivery day</dt>
            <dd>23:00 D−1 to 23:00 D, UK time (auction / EFA day)</dd>
            <dt className="text-muted">Forecast</dt>
            <dd>Per hour, the latest run published by gate closure on D−1</dd>
            <dt className="text-muted">Error</dt>
            <dd>Forecast − outturn. Positive means less wind than planned</dd>
            <dt className="text-muted">Adjusted</dt>
            <dd>Forecast × outturn/forecast ratio of the previous 7 days, using only data known at gate closure</dd>
            {snap && (
              <>
                <dt className="text-muted">Snapshot</dt>
                <dd className="tabular-nums">
                  {ukDayTime(snap.generated_at)} · {snap.rows.wind_forecast.toLocaleString('en-GB')} forecast points ·{' '}
                  {snap.rows.wind_actual.toLocaleString('en-GB')} half-hours
                  {offSchedule.length > 0 && (
                    <span className="block text-muted">
                      Off-schedule run{offSchedule.length > 1 ? 's' : ''}: {offSchedule.map(ukDayTime).join(', ')}
                    </span>
                  )}
                </dd>
              </>
            )}
          </dl>
          <Popover.Arrow className="fill-raised" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
