import { describe, expect, it } from 'vitest'
import { periodLabel, presets } from './periods'

describe('periods', () => {
  it('splits the window into Monday–Sunday weeks', () => {
    expect(presets('2026-01-02', '2026-02-01').map((p) => [p.from, p.to])).toEqual([
      ['2026-01-02', '2026-02-01'],
      ['2026-01-02', '2026-01-04'],
      ['2026-01-05', '2026-01-11'],
      ['2026-01-12', '2026-01-18'],
      ['2026-01-19', '2026-01-25'],
      ['2026-01-26', '2026-02-01'],
    ])
  })

  it('labels ranges compactly', () => {
    expect(periodLabel('2026-01-12', '2026-01-18')).toBe('12 – 18 Jan 2026')
    expect(periodLabel('2026-01-26', '2026-02-01')).toBe('26 Jan – 1 Feb 2026')
  })
})
