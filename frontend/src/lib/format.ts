export const UK_TZ = 'Europe/London'
const MINUS = '−'
const DASH = '—'

type Num = number | null | undefined

const withMinus = (s: string) => s.replace('-', MINUS)

export function gw(mw: Num, dp = 2): string {
  return mw == null ? DASH : `${withMinus((mw / 1000).toFixed(dp))} GW`
}

export function signedGw(mw: Num, dp = 2): string {
  if (mw == null) return DASH
  const body = (Math.abs(mw) / 1000).toFixed(dp)
  const sign = Number(body) === 0 ? '' : mw > 0 ? '+' : MINUS
  return `${sign}${body} GW`
}

export function gwh(value: Num, dp = 1): string {
  if (value == null) return DASH
  const body = Math.abs(value).toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp })
  return `${value < 0 ? MINUS : ''}${body} GWh`
}

export function signedPct(value: Num, dp = 0): string {
  if (value == null) return DASH
  const body = Math.abs(value).toFixed(dp)
  return `${Number(body) === 0 ? '' : value > 0 ? '+' : MINUS}${body}%`
}

export function hours(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1)
}

const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: UK_TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: UK_TZ,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** "23:00" in UK local time. */
export const ukTime = (ts: string | number | Date) => timeFmt.format(new Date(ts))

function parts(ts: Date) {
  const p = Object.fromEntries(partsFmt.formatToParts(ts).map((x) => [x.type, x.value]))
  return { weekday: p.weekday, day: p.day, month: p.month, year: p.year }
}

/** Civil date "2026-01-12" → "Mon 12 Jan 2026". */
export function dayLabel(date: string): string {
  const p = parts(new Date(`${date}T12:00:00Z`))
  return `${p.weekday} ${p.day} ${p.month} ${p.year}`
}

/** Timestamp → "Sun 11 Jan 09:20" in UK local time. */
export function ukDayTime(ts: string): string {
  const p = parts(new Date(ts))
  return `${p.weekday} ${p.day} ${p.month} ${ukTime(ts)}`
}
