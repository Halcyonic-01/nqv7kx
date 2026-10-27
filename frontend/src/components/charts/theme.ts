import { useMemo, useSyncExternalStore } from 'react'

export type ChartTokens = {
  font: string
  ink: string
  ink2: string
  muted: string
  grid: string
  axis: string
  raised: string
  hairline: string
  fc: string
  act: string
  adj: string
  over: string
  under: string
  run: string
}

const dark = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null
const reducedMotion = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null

const subscribe = (cb: () => void) => {
  dark?.addEventListener('change', cb)
  return () => dark?.removeEventListener('change', cb)
}

// Keyed by scheme so the memo re-reads after a flip.
function readTokens(_isDark: boolean): ChartTokens {
  const s = getComputedStyle(document.documentElement)
  const v = (name: string) => s.getPropertyValue(name).trim()
  return {
    font: v('--font-sans') || 'system-ui, sans-serif',
    ink: v('--ink'),
    ink2: v('--ink-2'),
    muted: v('--muted'),
    grid: v('--grid'),
    axis: v('--axis'),
    raised: v('--raised'),
    hairline: v('--hairline'),
    fc: v('--fc'),
    act: v('--act'),
    adj: v('--adj'),
    over: v('--over'),
    under: v('--under'),
    run: v('--run'),
  }
}

/** Chart colours from the CSS tokens; re-read when the colour scheme flips. */
export function useChartTokens(): ChartTokens {
  const isDark = useSyncExternalStore(subscribe, () => dark?.matches ?? false, () => false)
  return useMemo(() => readTokens(isDark), [isDark])
}

export const animate = () => !(reducedMotion?.matches ?? false)

/** Hex + alpha → rgba(), for washes like the forecast band. */
export function alpha(hex: string, a: number): string {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}
