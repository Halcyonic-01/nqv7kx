import type { ChartTokens } from './theme'

/** Shared chrome so every chart reads as one system. */
export function textStyle(t: ChartTokens) {
  return { fontFamily: t.font, color: t.ink2 }
}

export function axisLabel(t: ChartTokens) {
  return { color: t.muted, fontSize: 11 }
}

export function valueAxis(t: ChartTokens, extra: object = {}) {
  return {
    type: 'value',
    axisLabel: axisLabel(t),
    splitLine: { lineStyle: { color: t.grid } },
    ...extra,
  }
}

export function tooltip(t: ChartTokens, extra: object = {}) {
  return {
    confine: true,
    backgroundColor: t.raised,
    borderColor: t.hairline,
    borderWidth: 1,
    padding: [8, 12],
    textStyle: { color: t.ink, fontSize: 12, fontFamily: t.font },
    extraCssText: 'border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.08);min-width:180px',
    ...extra,
  }
}

export function crosshair(t: ChartTokens) {
  return { type: 'line', snap: false, label: { show: false }, lineStyle: { color: t.muted, width: 1, type: 'solid' } }
}

export function zeroLine(t: ChartTokens) {
  return { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: t.axis, width: 1, type: 'solid' }, data: [{ yAxis: 0 }] }
}

export function lineKey(color: string, dashed = false): HTMLElement {
  const key = document.createElement('span')
  key.style.cssText = `display:inline-block;width:12px;margin-right:8px;vertical-align:middle;border-top:2px ${dashed ? 'dashed' : 'solid'} ${color}`
  return key
}

export function areaKey(color: string): HTMLElement {
  const key = document.createElement('span')
  key.style.cssText = `display:inline-block;width:10px;height:10px;margin-right:8px;vertical-align:-1px;border-radius:2px;background:${color}`
  return key
}

export function tooltipHead(text: string): HTMLElement {
  const head = document.createElement('div')
  head.style.cssText = 'color:var(--muted);margin-bottom:4px;font-variant-numeric:tabular-nums'
  head.textContent = text
  return head
}

export function tooltipRow(label: string, value: string, key?: HTMLElement): HTMLElement {
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

/** Signed GW tick from MW, with a true minus sign. */
export function gwTick(mw: number): string {
  const v = mw / 1000
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}`
}
