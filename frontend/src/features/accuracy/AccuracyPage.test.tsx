import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Accuracy, LeadTime, Meta } from '../../lib/api/client'

vi.mock('../../components/charts/EChart', () => ({
  EChart: ({ label }: { label: string }) => <div role="img" aria-label={label} />,
}))

const meta = {
  coverage: { first: '2026-01-02', last: '2026-02-01' },
  gate_closures: [{ id: 'epex', label: 'EPEX GB 60-min', time: '09:20' }],
  default_gate_closure: '09:20',
  delivery_day_start: '23:00',
  timezone: 'Europe/London',
  run_schedule_utc: [],
  snapshot: { generated_at: '2026-10-27T18:40:00Z', data_sha256: 'x', rows: { wind_forecast: 1, wind_actual: 1 }, quality: {} },
} satisfies Meta

const day = (date: string, mae: number) => ({
  delivery_date: date,
  n: 24,
  mae_mw: mae,
  bias_mw: mae,
  forecast_gwh: 400,
  actual_gwh: 300,
})

const accuracy = {
  first: '2026-01-02',
  last: '2026-02-01',
  metrics: {
    n: 744,
    mae_mw: 2019,
    rmse_mw: 2491,
    bias_mw: 1747,
    wape_pct: 17.9,
    p50_abs_mw: 1656,
    p90_abs_mw: 4146,
    p99_abs_mw: 6194,
    p10_mw: -417,
    p90_mw: 4146,
    over_forecast_pct: 84.9,
  },
  adjusted: { n: 648, raw_mae_mw: 2034, adjusted_mae_mw: 1332, raw_bias_mw: 1774, adjusted_bias_mw: 255 },
  decision_lead_h: { min: 15.5, max: 38.5 },
  daily: [day('2026-01-12', 5026), day('2026-01-19', 632), day('2026-01-28', 5286)],
  by_hour: [],
  by_forecast_level: [{ label: '≥16 GW', lo_mw: 16000, hi_mw: null, n: 272, mae_mw: 2900, bias_mw: 2819, actual_to_forecast: 0.847 }],
  histogram: { edges_mw: [0, 500], counts: [10] },
} satisfies Accuracy

const lead = {
  first: '2026-01-02',
  last: '2026-02-01',
  rows: [{ horizon_h: 0, n: 744, mae_mw: 1684, bias_mw: 1475, p10_mw: -500, p90_mw: 3400, effective_lead_h: 1.6 }],
} satisfies LeadTime

let App: typeof import('../../app/App').default

beforeAll(async () => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  App = (await import('../../app/App')).default
})

afterEach(() => vi.unstubAllGlobals())

describe('AccuracyPage', () => {
  it('shows headline metrics and links the worst days to their day view', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith('/api/v1/meta')) return Response.json(meta)
      if (url.startsWith('/api/v1/accuracy/lead-time')) return Response.json(lead)
      return Response.json(accuracy)
    })
    vi.stubGlobal('fetch', fetchMock)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/accuracy?gc=09:50&from=2026-01-12&to=2026-01-18']}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('2.02 GW')).toBeTruthy()
    expect(screen.getByText('+1.75 GW')).toBeTruthy()
    expect(screen.getByText('Over-forecast in 85% of hours')).toBeTruthy()
    expect(screen.getByText(/−35% vs 2.03 GW/)).toBeTruthy()

    const worst = screen.getAllByRole('link', { name: 'Wed 28 Jan 2026' })[0]
    expect(worst.getAttribute('href')).toBe('/day-ahead/2026-01-28?gc=09%3A50')
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/accuracy?from=2026-01-12&to=2026-01-18&gate_closure=09%3A50')
  })
})
