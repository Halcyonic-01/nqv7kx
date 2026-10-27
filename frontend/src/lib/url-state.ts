import { useCallback } from 'react'
import { useSearchParams } from 'react-router'

export const DEFAULT_GATE_CLOSURE = '09:20'
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

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
