import { type ReactNode, useCallback, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { type ChartClick, EChart } from '../../components/charts/EChart'
import { alpha, useChartTokens } from '../../components/charts/theme'
import { ErrorState } from '../../components/ui/ErrorState'
import { LegendItem } from '../../components/ui/LegendItem'
import { Skeleton } from '../../components/ui/Skeleton'
import { type Stat, StatRow } from '../../components/ui/StatRow'
import type { Accuracy, LeadTime } from '../../lib/api/client'
import { useAccuracy, useLeadTime, useMeta } from '../../lib/api/queries'
import { gw, hours, signedGw, signedPct } from '../../lib/format'
import { sharedSearch, useGateClosure, usePeriod } from '../../lib/url-state'
import { dailyOption, histogramOption, leadTimeOption, levelOption } from './chartOptions'
import { DailyTable, WorstDays } from './DaysTable'
import { PeriodPicker } from './PeriodPicker'
import { periodLabel } from './periods'

function Panel({ title, note, legend, children }: { title: string; note?: string; legend?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
        <div>
          <h2 className="text-[13px] font-medium">{title}</h2>
          {note && <p className="text-[12px] text-ink-2">{note}</p>}
        </div>
        {legend && <div className="flex flex-wrap items-center gap-1.5">{legend}</div>}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  )
}

function headline(acc: Accuracy): Stat[] {
  const m = acc.metrics
  if (!m) return []
  const days = acc.daily.length
  const stats: Stat[] = [
    { label: 'Mean absolute error', value: gw(m.mae_mw), detail: `RMSE ${gw(m.rmse_mw)}` },
    { label: 'Bias', value: signedGw(m.bias_mw), detail: `Over-forecast in ${m.over_forecast_pct.toFixed(0)}% of hours` },
    { label: 'P90 absolute error', value: gw(m.p90_abs_mw), detail: `P99 ${gw(m.p99_abs_mw)}` },
    { label: 'WAPE', value: `${m.wape_pct.toFixed(1)}%`, detail: `${m.n} hours · ${days} day${days === 1 ? '' : 's'}` },
  ]
  const adj = acc.adjusted
  if (adj) {
    stats.push({
      label: 'Bias-adjusted MAE',
      value: gw(adj.adjusted_mae_mw),
      detail: `${signedPct(((adj.adjusted_mae_mw - adj.raw_mae_mw) / adj.raw_mae_mw) * 100)} vs ${gw(adj.raw_mae_mw)}, same ${adj.n} h`,
    })
  }
  return stats
}

function leadNote(lead: LeadTime): string | undefined {
  const first = lead.rows[0]
  const last = lead.rows.at(-1)
  return first && last ? `MAE ${gw(first.mae_mw)} at ${first.horizon_h} h ahead, ${gw(last.mae_mw)} at ${last.horizon_h} h` : undefined
}

function PageSkeleton() {
  return (
    <div className="space-y-5" aria-busy>
      <Skeleton className="h-8 w-60" />
      <Skeleton className="h-[88px]" />
      <Skeleton className="h-[260px]" />
      <div className="grid gap-8 lg:grid-cols-2">
        <Skeleton className="h-[260px]" />
        <Skeleton className="h-[260px]" />
      </div>
    </div>
  )
}

export function AccuracyPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { data: meta, error: metaError, refetch: refetchMeta } = useMeta()
  const [gateClosure] = useGateClosure()
  const first = meta?.coverage.first ?? ''
  const last = meta?.coverage.last ?? ''
  const [from, to, setPeriod] = usePeriod(first, last)
  const accuracy = useAccuracy(meta ? from : '', meta ? to : '', gateClosure)
  const lead = useLeadTime(meta ? from : '', meta ? to : '')
  const t = useChartTokens()
  const search = sharedSearch(params)

  useEffect(() => {
    if (meta) document.title = `Accuracy · ${periodLabel(from, to)} — Beaufort`
  }, [meta, from, to])

  const acc = accuracy.data
  const options = useMemo(
    () =>
      acc && lead.data
        ? {
            daily: dailyOption(acc, t),
            lead: leadTimeOption(lead.data, acc.decision_lead_h, t),
            hist: histogramOption(acc, t),
            level: levelOption(acc, t),
          }
        : null,
    [acc, lead.data, t],
  )
  const openDay = useCallback(
    (e: ChartClick) => {
      const day = acc?.daily[e.dataIndex]
      if (day) navigate(`/day-ahead/${day.delivery_date}${search}`)
    },
    [acc, navigate, search],
  )

  if (metaError) return <ErrorState message={metaError.message} onRetry={() => refetchMeta()} />
  const failed = accuracy.error ?? lead.error
  if (failed && !options) return <ErrorState message={failed.message} onRetry={() => (accuracy.refetch(), lead.refetch())} />
  if (!meta || !acc || !options || !lead.data) return <PageSkeleton />

  const fetching = accuracy.isPlaceholderData || lead.isPlaceholderData
  const decision = acc.decision_lead_h
  const top = acc.by_forecast_level.at(-1)

  return (
    <div className={`space-y-6 transition-opacity ${fetching ? 'opacity-60' : ''}`}>
      <h1 className="sr-only">Forecast accuracy, {periodLabel(from, to)}</h1>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <PeriodPicker first={first} last={last} from={from} to={to} onChange={setPeriod} />
        <p className="text-[13px] text-ink-2">
          Gate closure {gateClosure} on D−1
          {decision && ` · forecasts ${hours(decision.min)}–${hours(decision.max)} h ahead`}
        </p>
      </div>

      <StatRow stats={headline(acc)} />

      <Panel
        title="Daily error"
        note="Select a day to open it"
        legend={
          <>
            <LegendItem label="MAE" swatch={{ kind: 'line', color: t.ink }} />
            <LegendItem label="Bias, over-forecast" swatch={{ kind: 'area', color: t.over }} />
            <LegendItem label="Bias, under-forecast" swatch={{ kind: 'area', color: t.under }} />
          </>
        }
      >
        <EChart
          option={options.daily}
          height={260}
          onClick={openDay}
          label={`Daily MAE and bias for ${acc.daily.length} delivery days. Use the daily data table to open a day.`}
        />
      </Panel>

      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-2">
        <Panel
          title="Error by lead time"
          note={leadNote(lead.data)}
          legend={
            <>
              <LegendItem label="MAE" swatch={{ kind: 'line', color: t.ink }} />
              <LegendItem label="Bias" swatch={{ kind: 'line', color: t.over }} />
              <LegendItem label="P10–P90" swatch={{ kind: 'area', color: alpha(t.over, 0.25) }} />
            </>
          }
        >
          <EChart
            option={options.lead}
            height={260}
            label="Forecast error against minimum lead time from 0 to 48 hours, with the decision lead time shaded."
          />
        </Panel>

        <Panel
          title="Error distribution"
          note={
            acc.metrics
              ? `80% of hours between ${signedGw(acc.metrics.p10_mw, 1)} and ${signedGw(acc.metrics.p90_mw, 1)}`
              : undefined
          }
        >
          <EChart option={options.hist} height={260} label="Histogram of hourly forecast error in 0.5 GW bins." />
        </Panel>

        <Panel
          title="Bias by forecast level"
          note={top ? `Above ${top.lo_mw / 1000} GW, outturn averages ${(top.actual_to_forecast * 100).toFixed(0)}% of forecast` : undefined}
        >
          <EChart option={options.level} height={260} label="Mean forecast error grouped by forecast level." />
        </Panel>

        <Panel title="Largest daily errors">
          <WorstDays days={acc.daily} search={search} />
        </Panel>
      </div>

      <DailyTable days={acc.daily} search={search} />
    </div>
  )
}
