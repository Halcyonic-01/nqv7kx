import type { ChartOption } from '../../components/charts/EChart'
import { type ChartTokens, alpha, animate } from '../../components/charts/theme'
import type { DayAhead, DayRuns, Point } from '../../lib/api/client'
import { gw, signedGw, ukTime } from '../../lib/format'
import { hoursBetween } from '../../lib/time'

export type Layers = { band: boolean; adjusted: boolean; runs: boolean }
type XY = [number, number | null]

// Both panels share these so their x axes line up exactly.
const GRID_X = { left: 44, right: 16, outerBoundsMode: 'none' }
const EFA_HOURS = 4

/** Hold each value until the next point; repeat the last one to close the window. */
function stepped(points: XY[], end: number): XY[] {
  return points.length ? [...points, [end, points[points.length - 1][1]]] : points
}

function xAxis(t: ChartTokens, start: string, hours: number) {
  return {
    type: 'value',
    min: 0,
    max: hours,
    interval: EFA_HOURS,
    axisLine: { show: false, onZero: false },
    axisTick: { show: false },
    splitLine: { show: true, lineStyle: { color: t.grid, width: 1 } },
    axisLabel: {
      color: t.muted,
      fontSize: 11,
      margin: 10,
      formatter: (v: number) => ukTime(Date.parse(start) + v * 3_600_000),
    },
    axisPointer: { show: true, type: 'line', snap: false, label: { show: false }, lineStyle: { color: t.muted, width: 1, type: 'solid' } },
  }
}

function textStyle(t: ChartTokens) {
  return { fontFamily: t.font, color: t.ink2 }
}

function lineKey(color: string, dashed = false): HTMLElement {
  const key = document.createElement('span')
  key.style.cssText = `display:inline-block;width:12px;margin-right:8px;vertical-align:middle;border-top:2px ${dashed ? 'dashed' : 'solid'} ${color}`
  return key
}

function row(label: string, value: string, key?: HTMLElement): HTMLElement {
  const el = document.createElement('div')
  el.style.cssText = 'display:flex;justify-content:space-between;gap:20px;line-height:20px'
  const name = document.createElement('span')
  name.style.color = 'var(--ink-2)'
  if (key) name.append(key)
  name.append(document.createTextNode(label))
  const val = document.createElement('strong')
  val.style.cssText = 'font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums'
  val.textContent = value
  el.append(name, val)
  return el
}

/** Forecast vs outturn for the delivery day, with optional band, adjusted line and other runs. */
export function generationOption(day: DayAhead, runs: DayRuns | undefined, layers: Layers, t: ChartTokens): ChartOption {
  const start = day.window.start
  const hours = hoursBetween(start, day.window.end)
  const x = (ts: string) => hoursBetween(start, ts)
  const hourly = (pick: (p: Point) => number | null | undefined): XY[] =>
    stepped(
      day.points.map((p) => [x(p.start), pick(p) ?? null]),
      hours,
    )

  const byHour = new Map(day.points.map((p) => [Math.round(x(p.start)), p]))
  const usedRun = day.run_used?.publish_time
  const base = { type: 'line', step: 'start', symbol: 'none', showSymbol: false, smooth: false }

  const series: object[] = []
  if (layers.band) {
    const low = day.points.map((p) => p.band_low_mw)
    series.push(
      { ...base, name: 'band-low', stack: 'band', silent: true, lineStyle: { opacity: 0 }, data: hourly((p) => p.band_low_mw) },
      {
        ...base,
        name: 'band',
        stack: 'band',
        silent: true,
        lineStyle: { opacity: 0 },
        areaStyle: { color: alpha(t.fc, 0.12) },
        data: stepped(
          day.points.map((p, i) => [x(p.start), p.band_high_mw != null && low[i] != null ? p.band_high_mw - low[i]! : null]),
          hours,
        ),
      },
    )
  }
  if (layers.runs && runs) {
    for (const run of runs.runs) {
      if (run.publish_time === usedRun) continue
      series.push({
        ...base,
        name: `run-${run.publish_time}`,
        silent: true,
        z: 1,
        lineStyle: { width: 1, color: t.run, type: run.available_at_gate_closure ? 'solid' : 'dashed' },
        data: stepped(
          run.points.map((p) => [x(p.start), p.mw]),
          hours,
        ),
      })
    }
  }
  if (layers.adjusted) {
    series.push({ ...base, name: 'adjusted', z: 2, lineStyle: { width: 2, color: t.adj, type: [6, 4] }, data: hourly((p) => p.adjusted_mw) })
  }
  series.push(
    { ...base, name: 'forecast', z: 3, lineStyle: { width: 2, color: t.fc }, data: hourly((p) => p.forecast_mw) },
    {
      ...base,
      name: 'outturn',
      z: 4,
      lineStyle: { width: 2, color: t.act },
      data: stepped(
        day.actuals_hh.map((a) => [x(a.start), a.actual_mw]),
        hours,
      ),
    },
  )

  return {
    animation: animate(),
    animationDuration: 300,
    textStyle: textStyle(t),
    grid: { ...GRID_X, top: 28, bottom: 28 },
    xAxis: xAxis(t, start, hours),
    yAxis: {
      type: 'value',
      min: 0,
      splitNumber: 4,
      name: 'GW',
      nameTextStyle: { color: t.muted, fontSize: 11, align: 'right', padding: [0, 6, 0, 0] },
      axisLabel: { color: t.muted, fontSize: 11, formatter: (v: number) => `${v / 1000}` },
      splitLine: { lineStyle: { color: t.grid } },
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: t.raised,
      borderColor: t.hairline,
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: t.ink, fontSize: 12, fontFamily: t.font },
      extraCssText: 'border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.08);min-width:200px',
      formatter: (params: { axisValue: number }[]) => {
        const h = Math.min(Math.floor(params[0]?.axisValue ?? 0), Math.ceil(hours) - 1)
        const p = byHour.get(h)
        const box = document.createElement('div')
        if (!p) return box
        const head = document.createElement('div')
        head.style.cssText = 'color:var(--muted);margin-bottom:4px;font-variant-numeric:tabular-nums'
        head.textContent = `${ukTime(p.start)}–${ukTime(Date.parse(p.start) + 3_600_000)}`
        box.append(head, row('Forecast', gw(p.forecast_mw), lineKey(t.fc)), row('Outturn', gw(p.actual_mw), lineKey(t.act)))
        box.append(row('Error', signedGw(p.error_mw)))
        if (layers.adjusted) box.append(row('Adjusted', gw(p.adjusted_mw), lineKey(t.adj, true)))
        if (layers.band && p.band_low_mw != null && p.band_high_mw != null)
          box.append(row('P10–P90', `${(p.band_low_mw / 1000).toFixed(1)}–${gw(p.band_high_mw, 1)}`))
        return box
      },
    },
    series,
  }
}

/** Forecast − outturn per hour; positive (shortfall) above the line. */
export function errorOption(day: DayAhead, t: ChartTokens): ChartOption {
  const start = day.window.start
  const hours = hoursBetween(start, day.window.end)
  const data = day.points
    .filter((p) => p.error_mw != null)
    .map((p) => {
      const over = p.error_mw! > 0
      return {
        value: [hoursBetween(start, p.start) + 0.5, p.error_mw],
        itemStyle: { color: over ? t.over : t.under, borderRadius: over ? [4, 4, 0, 0] : [0, 0, 4, 4] },
      }
    })

  return {
    animation: animate(),
    animationDuration: 300,
    textStyle: textStyle(t),
    grid: { ...GRID_X, top: 10, bottom: 28 },
    xAxis: xAxis(t, start, hours),
    yAxis: {
      type: 'value',
      splitNumber: 2,
      axisLabel: { color: t.muted, fontSize: 11, formatter: (v: number) => `${v > 0 ? '+' : ''}${v / 1000}` },
      splitLine: { lineStyle: { color: t.grid } },
    },
    tooltip: { trigger: 'axis', showContent: false },
    series: [
      {
        type: 'bar',
        barWidth: '62%',
        barMaxWidth: 18,
        data,
        markLine: { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: t.axis, width: 1, type: 'solid' }, data: [{ yAxis: 0 }] },
      },
    ],
  }
}
