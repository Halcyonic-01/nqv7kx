import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { DayAhead, Meta } from '../../lib/api/client'

vi.mock('../../components/charts/EChart', () => ({
  EChart: ({ label }: { label: string }) => <div role="img" aria-label={label} />,
}))

const meta = {
  coverage: { first: '2026-01-02', last: '2026-02-01' },
  gate_closures: [
    { id: 'epex', label: 'EPEX GB 60-min', time: '09:20' },
    { id: 'n2ex', label: 'N2EX', time: '09:50' },
  ],
  default_gate_closure: '09:20',
  delivery_day_start: '23:00',
  timezone: 'Europe/London',
  run_schedule_utc: [],
  snapshot: { generated_at: '2026-10-27T18:40:00Z', data_sha256: 'x', rows: { wind_forecast: 1, wind_actual: 1 }, quality: {} },
} satisfies Meta

const day = {
  delivery_date: '2026-01-12',
  window: { start: '2026-01-11T23:00:00Z', end: '2026-01-12T23:00:00Z' },
  gate_closure: '2026-01-11T09:20:00Z',
  run_used: { publish_time: '2026-01-11T07:30:00Z', lead_h_min: 15.5, lead_h_max: 38.5 },
  next_run: '2026-01-11T09:30:00Z',
  calibration: null,
  summary: {
    forecast_gwh: 467.9,
    actual_gwh: 347.3,
    mae_mw: 5026,
    bias_mw: 5026,
    max_shortfall_mw: 6894,
    max_shortfall_at: '2026-01-12T01:00:00Z',
    adjusted_mae_mw: null,
  },
  points: [
    {
      start: '2026-01-11T23:00:00Z',
      forecast_mw: 20565,
      actual_mw: 14393,
      error_mw: 6172,
      adjusted_mw: null,
      band_low_mw: null,
      band_high_mw: null,
    },
  ],
  actuals_hh: [{ start: '2026-01-11T23:00:00Z', actual_mw: 14393 }],
} satisfies DayAhead

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

let App: typeof import('../../app/App').default

beforeAll(async () => {
  // jsdom lacks these browser APIs.
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  App = (await import('../../app/App')).default
})

afterEach(() => vi.unstubAllGlobals())

function mockApi(dayStatus = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.startsWith('/api/v1/meta')) return Response.json(meta)
      if (dayStatus !== 200) return Response.json({ detail: 'Upstream unavailable' }, { status: dayStatus })
      return Response.json(day)
    }),
  )
}

describe('DayAheadPage', () => {
  it('shows the decision context and day summary', async () => {
    mockApi()
    renderAt('/day-ahead/2026-01-12')

    expect(await screen.findByText('467.9 GWh')).toBeTruthy()
    expect(screen.getByText('347.3 GWh')).toBeTruthy()
    expect(screen.getByText('5.03 GW')).toBeTruthy()
    expect(screen.getByText('Sun 11 Jan 09:20')).toBeTruthy()
    expect(screen.getByText('07:30')).toBeTruthy()
    expect(screen.getByText('15.5–38.5 h')).toBeTruthy()
    expect(screen.getAllByRole('img', { name: /Hourly wind forecast/ })).toHaveLength(1)
  })

  it('offers a retry when the API fails', async () => {
    mockApi(500)
    renderAt('/day-ahead/2026-01-12')

    expect(await screen.findByText('Upstream unavailable')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })
})
