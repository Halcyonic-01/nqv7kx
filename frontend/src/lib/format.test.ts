import { describe, expect, it } from 'vitest'
import { dayLabel, gw, gwh, signedGw, signedPct, ukDayTime, ukTime } from './format'

describe('format', () => {
  it('formats power in GW with a true minus sign', () => {
    expect(gw(5026)).toBe('5.03 GW')
    expect(gw(-417)).toBe('−0.42 GW')
    expect(gw(null)).toBe('—')
  })

  it('signs errors and drops the sign at zero', () => {
    expect(signedGw(1747)).toBe('+1.75 GW')
    expect(signedGw(-1747)).toBe('−1.75 GW')
    expect(signedGw(2)).toBe('0.00 GW')
  })

  it('formats energy and percentages', () => {
    expect(gwh(1234.56)).toBe('1,234.6 GWh')
    expect(gwh(-120.6)).toBe('−120.6 GWh')
    expect(signedPct(-25.8)).toBe('−26%')
  })

  it('renders times in UK local time, across BST', () => {
    expect(ukTime('2026-01-11T23:00:00Z')).toBe('23:00')
    expect(ukTime('2026-06-14T08:20:00Z')).toBe('09:20')
    expect(ukDayTime('2026-01-11T09:20:00Z')).toBe('Sun 11 Jan 09:20')
    expect(dayLabel('2026-01-12')).toBe('Mon 12 Jan 2026')
  })
})
