import {
  areaKey,
  axisLabel,
  crosshair,
  gwTick,
  lineKey,
  textStyle,
  tooltip,
  tooltipHead,
  tooltipRow as row,
  valueAxis,
  zeroLine,
} from '../../components/charts/common'
import type { ChartOption } from '../../components/charts/EChart'
import { type ChartTokens, alpha, animate } from '../../components/charts/theme'
import type { Accuracy, LeadTime } from '../../lib/api/client'
import { dayLabel, gw, gwh, signedGw } from '../../lib/format'

const GRID = { left: 44, right: 16, top: 24, bottom: 28, outerBoundsMode: 'none' }
const signColor = (t: ChartTokens, v: number) => (v > 0 ? t.over : t.under)
const roundedEnd = (v: number) => (v > 0 ? [4, 4, 0, 0] : [0, 0, 4, 4])

function base(t: ChartTokens) {
  return { animation: animate(), animationDuration: 300, textStyle: textStyle(t), grid: GRID }
}

/** Daily bias (bars, by sign) and MAE (line); bars are the drill-down target. */
export function dailyOption(acc: Accuracy, t: ChartTokens): ChartOption {
  const days = acc.daily
  const worst = days.reduce((w, d, i) => (d.mae_mw > days[w].mae_mw ? i : w), 0)
  return {
    ...base(t),
    xAxis: {
      type: 'category',
      data: days.map((d) => d.delivery_date),
      axisLine: { lineStyle: { color: t.axis } },
      axisTick: { show: false },
      axisLabel: { ...axisLabel(t), formatter: (d: string) => dayLabel(d).split(' ').slice(1, 3).join(' ') },
      axisPointer: { type: 'shadow', shadowStyle: { color: alpha(t.ink, 0.04) } },
    },
    yAxis: valueAxis(t, { splitNumber: 3, axisLabel: { ...axisLabel(t), formatter: gwTick } }),
    tooltip: tooltip(t, {
      trigger: 'axis',
      formatter: (params: { dataIndex: number }[]) => {
        const d = days[params[0]?.dataIndex ?? 0]
        const box = document.createElement('div')
        box.append(
          tooltipHead(dayLabel(d.delivery_date)),
          row('MAE', gw(d.mae_mw), lineKey(t.ink)),
          row('Bias', signedGw(d.bias_mw), areaKey(signColor(t, d.bias_mw))),
          row('Forecast', gwh(d.forecast_gwh)),
          row('Outturn', gwh(d.actual_gwh)),
          tooltipHead('Click to open the day'),
        )
        return box
      },
    }),
    series: [
      {
        name: 'bias',
        type: 'bar',
        barMaxWidth: 18,
        cursor: 'pointer',
        data: days.map((d) => ({
          value: d.bias_mw,
          itemStyle: { color: signColor(t, d.bias_mw), borderRadius: roundedEnd(d.bias_mw) },
        })),
        markLine: zeroLine(t),
      },
      {
        name: 'mae',
        type: 'line',
        cursor: 'pointer',
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { width: 2, color: t.ink },
        itemStyle: { color: t.ink, borderColor: t.raised, borderWidth: 2 },
        data: days.map((d, i) =>
          i === worst
            ? {
                value: d.mae_mw,
                label: { show: true, position: 'top', color: t.ink2, fontSize: 11, formatter: () => gw(d.mae_mw) },
              }
            : d.mae_mw,
        ),
        z: 3,
      },
    ],
  }
}

/** MAE and signed-error spread by minimum lead time, decision window shaded. */
export function leadTimeOption(lead: LeadTime, decision: Accuracy['decision_lead_h'], t: ChartTokens): ChartOption {
  const rows = lead.rows
  const at = (pick: (r: (typeof rows)[number]) => number) => rows.map((r) => [r.horizon_h, pick(r)])
  const byHour = new Map(rows.map((r) => [r.horizon_h, r]))
  const max = rows.at(-1)?.horizon_h ?? 48
  return {
    ...base(t),
    xAxis: {
      type: 'value',
      min: 0,
      max,
      interval: 6,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: t.grid } },
      axisLabel: { ...axisLabel(t), formatter: (v: number) => `${v} h` },
      axisPointer: crosshair(t),
    },
    yAxis: valueAxis(t, { splitNumber: 4, axisLabel: { ...axisLabel(t), formatter: gwTick } }),
    tooltip: tooltip(t, {
      trigger: 'axis',
      axisPointer: crosshair(t),
      formatter: (params: { axisValue: number }[]) => {
        const r = byHour.get(Math.round(params[0]?.axisValue ?? 0))
        const box = document.createElement('div')
        if (!r) return box
        box.append(
          tooltipHead(`Published ≥ ${r.horizon_h} h ahead (mean ${r.effective_lead_h} h)`),
          row('MAE', gw(r.mae_mw), lineKey(t.ink)),
          row('Bias', signedGw(r.bias_mw), lineKey(t.over)),
          row('P10–P90 error', `${signedGw(r.p10_mw, 1)} to ${signedGw(r.p90_mw, 1)}`, areaKey(alpha(t.over, 0.25))),
          row('Hours', String(r.n)),
        )
        return box
      },
    }),
    series: [
      {
        name: 'p10',
        type: 'line',
        stack: 'spread',
        stackStrategy: 'all',
        symbol: 'none',
        silent: true,
        lineStyle: { opacity: 0 },
        data: at((r) => r.p10_mw),
      },
      {
        name: 'spread',
        type: 'line',
        stack: 'spread',
        stackStrategy: 'all',
        symbol: 'none',
        silent: true,
        lineStyle: { opacity: 0 },
        areaStyle: { color: alpha(t.over, 0.12) },
        data: at((r) => r.p90_mw - r.p10_mw),
      },
      { name: 'bias', type: 'line', symbol: 'none', lineStyle: { width: 2, color: t.over }, data: at((r) => r.bias_mw) },
      {
        name: 'mae',
        type: 'line',
        symbol: 'none',
        lineStyle: { width: 2, color: t.ink },
        data: at((r) => r.mae_mw),
        markLine: zeroLine(t),
        markArea: decision
          ? {
              silent: true,
              itemStyle: { color: alpha(t.ink, 0.05) },
              label: { show: true, position: 'insideTop', color: t.muted, fontSize: 11, distance: 6 },
              data: [[{ xAxis: decision.min, name: 'Decision lead time' }, { xAxis: Math.min(decision.max, max) }]],
            }
          : undefined,
      },
    ],
  }
}

/** Signed error histogram; bins coloured by side of zero, P10/P90 marked. */
export function histogramOption(acc: Accuracy, t: ChartTokens): ChartOption {
  const { edges_mw: edges, counts } = acc.histogram
  const width = edges.length > 1 ? edges[1] - edges[0] : 500
  const marks = acc.metrics
    ? [
        { xAxis: acc.metrics.p10_mw, name: 'P10' },
        { xAxis: acc.metrics.bias_mw, name: 'Mean' },
        { xAxis: acc.metrics.p90_mw, name: 'P90' },
      ]
    : []
  return {
    ...base(t),
    xAxis: {
      type: 'value',
      min: edges[0],
      max: edges.at(-1),
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { ...axisLabel(t), formatter: gwTick, showMinLabel: false, showMaxLabel: false },
    },
    yAxis: valueAxis(t, { splitNumber: 3, minInterval: 1 }),
    tooltip: tooltip(t, {
      trigger: 'item',
      formatter: (p: { dataIndex: number }) => {
        const lo = edges[p.dataIndex]
        const box = document.createElement('div')
        box.append(
          tooltipHead(`${signedGw(lo, 1)} to ${signedGw(lo + width, 1)}`),
          row('Hours', String(counts[p.dataIndex])),
        )
        return box
      },
    }),
    series: [
      {
        type: 'bar',
        barWidth: '88%',
        data: counts.map((c, i) => {
          const mid = edges[i] + width / 2
          return { value: [mid, c], itemStyle: { color: signColor(t, mid), borderRadius: [4, 4, 0, 0] } }
        }),
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: t.ink2, width: 1, type: 'solid' },
          label: { color: t.ink2, fontSize: 11, formatter: '{b}', position: 'end' },
          data: [...marks, { xAxis: 0, name: '', lineStyle: { color: t.axis } }],
        },
      },
    ],
  }
}

/** Bias per forecast level: the higher the forecast, the larger the overstatement. */
export function levelOption(acc: Accuracy, t: ChartTokens): ChartOption {
  const levels = acc.by_forecast_level
  return {
    ...base(t),
    xAxis: {
      type: 'category',
      data: levels.map((l) => l.label),
      axisLine: { lineStyle: { color: t.axis } },
      axisTick: { show: false },
      axisLabel: axisLabel(t),
    },
    yAxis: valueAxis(t, { splitNumber: 3, axisLabel: { ...axisLabel(t), formatter: gwTick } }),
    tooltip: tooltip(t, {
      trigger: 'item',
      formatter: (p: { dataIndex: number }) => {
        const l = levels[p.dataIndex]
        const box = document.createElement('div')
        box.append(
          tooltipHead(`Forecast ${l.label}`),
          row('Bias', signedGw(l.bias_mw), areaKey(signColor(t, l.bias_mw))),
          row('MAE', gw(l.mae_mw)),
          row('Outturn / forecast', l.actual_to_forecast.toFixed(2)),
          row('Hours', String(l.n)),
        )
        return box
      },
    }),
    series: [
      {
        type: 'bar',
        barMaxWidth: 24,
        data: levels.map((l) => ({
          value: l.bias_mw,
          itemStyle: { color: signColor(t, l.bias_mw), borderRadius: roundedEnd(l.bias_mw) },
        })),
        label: {
          show: true,
          position: 'top',
          color: t.ink2,
          fontSize: 11,
          formatter: (p: { dataIndex: number }) => signedGw(levels[p.dataIndex].bias_mw, 1),
        },
        markLine: zeroLine(t),
      },
    ],
  }
}
