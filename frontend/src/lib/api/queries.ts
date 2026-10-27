import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import { type DayAhead, type DayRuns, getJson, type Meta } from './client'

// Snapshot data never changes, so cached results stay fresh.
export const metaQuery = queryOptions({
  queryKey: ['meta'],
  queryFn: () => getJson<Meta>('/meta'),
  staleTime: Infinity,
})

export const dayAheadQuery = (date: string, gateClosure: string) =>
  queryOptions({
    queryKey: ['day-ahead', date, gateClosure],
    queryFn: () => getJson<DayAhead>('/day-ahead', { delivery_date: date, gate_closure: gateClosure }),
    staleTime: Infinity,
  })

export const dayRunsQuery = (date: string, gateClosure: string) =>
  queryOptions({
    queryKey: ['day-ahead-runs', date, gateClosure],
    queryFn: () => getJson<DayRuns>('/day-ahead/runs', { delivery_date: date, gate_closure: gateClosure }),
    staleTime: Infinity,
  })

export const useMeta = () => useQuery(metaQuery)

export const useDayAhead = (date: string, gateClosure: string) =>
  useQuery({ ...dayAheadQuery(date, gateClosure), placeholderData: keepPreviousData })

export const useDayRuns = (date: string, gateClosure: string, enabled: boolean) =>
  useQuery({ ...dayRunsQuery(date, gateClosure), enabled, placeholderData: keepPreviousData })
