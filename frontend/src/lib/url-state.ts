import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { isIsoDate } from './time'

export const DEFAULT_GATE_CLOSURE = '09:20'
// Gate closure must fall before delivery starts at 23:00 on D-1.
const HHMM = /^([01]\d|2[0-2]):[0-5]\d$/

// Read the live URL: the hook's params are stale between quick successive updates.
const live = () => new URLSearchParams(window.location.search)

/** Gate closure lives in ?gc= so it survives navigation and deep links. */
export function useGateClosure(): [string, (value: string) => void] {
  const [params, setParams] = useSearchParams()
  const raw = params.get('gc')
  const value = raw && HHMM.test(raw) ? raw : DEFAULT_GATE_CLOSURE
  const set = useCallback(
    (next: string) =>
      setParams(
        () => {
          const p = live()
          if (next === DEFAULT_GATE_CLOSURE) p.delete('gc')
          else p.set('gc', next)
          return p
        },
        { replace: true },
      ),
    [setParams],
  )
  return [value, set]
}

/** Boolean ?key=1 / ?key=0 flag; the default is omitted from the URL. */
export function useUrlFlag(key: string, fallback: boolean): [boolean, (value: boolean) => void] {
  const [params, setParams] = useSearchParams()
  const raw = params.get(key)
  const value = raw === null ? fallback : raw === '1'
  const set = useCallback(
    (next: boolean) =>
      setParams(
        () => {
          const p = live()
          if (next === fallback) p.delete(key)
          else p.set(key, next ? '1' : '0')
          return p
        },
        { replace: true },
      ),
    [setParams, key, fallback],
  )
  return [value, set]
}

/** ?from=&to= period, clamped to coverage; defaults to the whole window. */
export function usePeriod(first: string, last: string): [string, string, (from: string, to: string) => void] {
  const [params, setParams] = useSearchParams()
  const ok = (d: string | null): d is string => isIsoDate(d) && d >= first && d <= last
  const rawFrom = params.get('from')
  const rawTo = params.get('to')
  let from = ok(rawFrom) ? rawFrom : first
  let to = ok(rawTo) ? rawTo : last
  if (from > to) [from, to] = [first, last]
  const set = useCallback(
    (nextFrom: string, nextTo: string) =>
      setParams(
        () => {
          const p = live()
          if (nextFrom === first && nextTo === last) {
            p.delete('from')
            p.delete('to')
          } else {
            p.set('from', nextFrom)
            p.set('to', nextTo)
          }
          return p
        },
        { replace: true },
      ),
    [setParams, first, last],
  )
  return [from, to, set]
}

/** Query string carrying only settings shared across pages. */
export function sharedSearch(params: URLSearchParams): string {
  const gc = params.get('gc')
  return gc ? `?gc=${encodeURIComponent(gc)}` : ''
}
