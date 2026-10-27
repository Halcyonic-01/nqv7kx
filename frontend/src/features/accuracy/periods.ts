import { addDays } from '../../lib/time'

export type Period = { from: string; to: string; label: string }

const short = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

export function periodLabel(from: string, to: string): string {
  const [a, b] = [short(from), short(to)]
  const sameMonth = from.slice(0, 7) === to.slice(0, 7)
  return `${sameMonth ? a.split(' ')[0] : a} – ${b} ${to.slice(0, 4)}`
}

/** Whole window, then Monday–Sunday weeks clipped to it. */
export function presets(first: string, last: string): Period[] {
  const out: Period[] = [{ from: first, to: last, label: 'Full period' }]
  let start = first
  while (start <= last) {
    const dow = (new Date(`${start}T12:00:00Z`).getUTCDay() + 6) % 7
    const sunday = addDays(start, 6 - dow)
    const end = sunday < last ? sunday : last
    out.push({ from: start, to: end, label: periodLabel(start, end) })
    start = addDays(end, 1)
  }
  return out
}
