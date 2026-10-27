import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router'
import { EChart } from '../../components/charts/EChart'
import { useChartTokens } from '../../components/charts/theme'
import { ErrorState } from '../../components/ui/ErrorState'
import { Skeleton } from '../../components/ui/Skeleton'
import { dayAheadQuery, useDayAhead, useDayRuns, useMeta } from '../../lib/api/queries'
import { dayLabel, ukTime } from '../../lib/format'
import { addDays, inRange, isIsoDate } from '../../lib/time'
import { useGateClosure, useUrlFlag } from '../../lib/url-state'
import { errorOption, generationOption } from './chartOptions'
import { DayContextBar } from './DayContextBar'
import { HourlyTable } from './HourlyTable'
import { LegendItem } from '../../components/ui/LegendItem'
import { StatStrip } from './StatStrip'

function PageSkeleton() {
  return (
    <div className="space-y-5" aria-busy>
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-[88px]" />
      <Skeleton className="h-[360px]" />
      <Skeleton className="h-[150px]" />
    </div>
  )
}

/** /day-ahead → latest delivery day. */
export function DayAheadIndex() {
  const { data: meta, error, refetch } = useMeta()
  const { search } = useLocation()
  if (meta) return <Navigate replace to={`/day-ahead/${meta.coverage.last}${search}`} />
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />
  return <PageSkeleton />
}

function useArrowKeys(onStep: (n: number) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (e.altKey || e.metaKey || e.ctrlKey || target.closest('input, textarea, [role="dialog"]')) return
      if (e.key === 'ArrowLeft') onStep(-1)
      if (e.key === 'ArrowRight') onStep(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onStep])
}

export function DayAheadPage() {
  const { date = '' } = useParams()
  const { search } = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: meta } = useMeta()
  const [gateClosure] = useGateClosure()
  const [band, setBand] = useUrlFlag('band', true)
  const [adjusted, setAdjusted] = useUrlFlag('adj', false)
  const [showRuns, setShowRuns] = useUrlFlag('runs', false)

  const first = meta?.coverage.first ?? ''
  const last = meta?.coverage.last ?? ''
  const valid = isIsoDate(date) && (!meta || inRange(date, first, last))

  const day = useDayAhead(date, gateClosure, valid)
  const runs = useDayRuns(date, gateClosure, showRuns && valid)
  const tokens = useChartTokens()

  const go = useCallback(
    (next: string) => {
      if (meta && inRange(next, first, last)) navigate(`/day-ahead/${next}${search}`)
    },
    [meta, first, last, navigate, search],
  )
  useArrowKeys(useCallback((n: number) => go(addDays(date, n)), [go, date]))

  useEffect(() => {
    if (!meta || !valid) return
    for (const d of [addDays(date, -1), addDays(date, 1)])
      if (inRange(d, first, last)) void queryClient.prefetchQuery(dayAheadQuery(d, gateClosure))
  }, [meta, valid, date, first, last, gateClosure, queryClient])

  useEffect(() => {
    if (isIsoDate(date)) document.title = `${dayLabel(date)} · Day-ahead — Beaufort`
  }, [date])

  const data = day.data
  // While a new day loads, the previous day's runs must not be drawn on it.
  const dayRuns =
    runs.data && data && runs.data.delivery_date === data.delivery_date && runs.data.gate_closure === data.gate_closure
      ? runs.data
      : undefined
  const genOption = useMemo(
    () => (data ? generationOption(data, dayRuns, { band, adjusted, runs: showRuns }, tokens) : null),
    [data, dayRuns, band, adjusted, showRuns, tokens],
  )
  const errOption = useMemo(() => (data ? errorOption(data, tokens) : null), [data, tokens])

  if (meta && !valid) return <Navigate replace to={`/day-ahead/${last}${search}`} />
  if (day.error && !data) return <ErrorState message={day.error.message} onRetry={() => day.refetch()} />
  if (!data || !meta || !genOption || !errOption) return <PageSkeleton />

  const fetching = day.isPlaceholderData
  const runLabel = data.run_used ? `Forecast · run ${ukTime(data.run_used.publish_time)}` : 'Forecast'

  return (
    <div className={`space-y-5 transition-opacity ${fetching ? 'opacity-60' : ''}`}>
      <h1 className="sr-only">Day-ahead forecast for delivery day {dayLabel(date)}</h1>
      <DayContextBar date={date} first={first} last={last} day={fetching ? undefined : data} onSelect={go} />
      <StatStrip day={data} />

      <section aria-labelledby="gen-title">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 id="gen-title" className="text-[13px] font-medium">
            National wind generation
          </h2>
          <div className="flex flex-wrap items-center gap-1.5">
            <LegendItem label={runLabel} swatch={{ kind: 'line', color: tokens.fc }} />
            <LegendItem label="Outturn" swatch={{ kind: 'line', color: tokens.act }} />
            <LegendItem
              label="P10–P90 range"
              swatch={{ kind: 'area', color: 'color-mix(in srgb, var(--fc) 22%, transparent)' }}
              pressed={band}
              onToggle={() => setBand(!band)}
            />
            <LegendItem
              label="Bias-adjusted"
              swatch={{ kind: 'line', color: tokens.adj, dashed: true }}
              pressed={adjusted}
              onToggle={() => setAdjusted(!adjusted)}
            />
            <LegendItem
              label="Other runs"
              swatch={{ kind: 'line', color: tokens.run }}
              pressed={showRuns}
              onToggle={() => setShowRuns(!showRuns)}
            />
          </div>
        </div>
        {showRuns && (
          <p className="mt-1 text-[12px] text-muted">
            Solid: published before gate closure · Dashed: published after, not available for the decision
          </p>
        )}
        <EChart
          option={genOption}
          height={360}
          group="day-ahead"
          className="mt-2"
          label={`Hourly wind forecast and half-hourly outturn for delivery day ${dayLabel(date)}. MAE ${(
            (data.summary.mae_mw ?? 0) / 1000
          ).toFixed(2)} GW.`}
        />
      </section>

      <section aria-labelledby="err-title">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 id="err-title" className="text-[13px] font-medium">
            Forecast error, GW
          </h2>
          <div className="flex items-center gap-1.5">
            <LegendItem label="Over-forecast (shortfall)" swatch={{ kind: 'area', color: tokens.over }} />
            <LegendItem label="Under-forecast" swatch={{ kind: 'area', color: tokens.under }} />
          </div>
        </div>
        <EChart
          option={errOption}
          height={150}
          group="day-ahead"
          className="mt-1"
          label="Hourly forecast error: forecast minus outturn. Positive values mean less wind than planned."
        />
      </section>

      <HourlyTable day={data} adjusted={adjusted} />
    </div>
  )
}
