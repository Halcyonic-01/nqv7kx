import { describe, expect, it } from 'vitest'
import { addDays, hoursBetween, inRange, isIsoDate, monthGrid } from './time'

describe('time', () => {
  it('adds civil days across month ends', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-01-02', -1)).toBe('2026-01-01')
  })

  it('measures hours between timestamps', () => {
    expect(hoursBetween('2026-01-11T23:00:00Z', '2026-01-12T23:00:00Z')).toBe(24)
  })

  it('validates dates and ranges', () => {
    expect(isIsoDate('2026-01-12')).toBe(true)
    expect(isIsoDate('12-01-2026')).toBe(false)
    expect(inRange('2026-02-01', '2026-01-02', '2026-02-01')).toBe(true)
    expect(inRange('2026-01-01', '2026-01-02', '2026-02-01')).toBe(false)
  })

  it('builds Monday-first month grids', () => {
    const jan = monthGrid(2026, 1)
    expect(jan[0]).toEqual([null, null, null, '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'])
    expect(jan.flat().filter(Boolean)).toHaveLength(31)
  })
})

describe('isIsoDate', () => {
  it('rejects impossible and malformed dates without throwing', () => {
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('2026-13-01')).toBe(false)
    expect(isIsoDate('2026-1-5')).toBe(false)
    expect(isIsoDate(null)).toBe(false)
    expect(isIsoDate('2028-02-29')).toBe(true)
  })
})
