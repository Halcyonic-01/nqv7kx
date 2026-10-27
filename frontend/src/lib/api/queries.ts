import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import { type Accuracy, type DayAhead, type DayRuns, getJson, type LeadTime, type Meta } from './client'

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

export const useDayAhead = (date: string, gateClosure: string, enabled = true) =>
  useQuery({ ...dayAheadQuery(date, gateClosure), enabled, placeholderData: keepPreviousData })

export const useDayRuns = (date: string, gateClosure: string, enabled: boolean) =>
  useQuery({ ...dayRunsQuery(date, gateClosure), enabled, placeholderData: keepPreviousData })

export const useAccuracy = (from: string, to: string, gateClosure: string) =>
  useQuery({
    queryKey: ['accuracy', from, to, gateClosure],
    queryFn: () => getJson<Accuracy>('/accuracy', { from, to, gate_closure: gateClosure }),
    staleTime: Infinity,
    enabled: !!from && !!to,
    placeholderData: keepPreviousData,
  })

export const useLeadTime = (from: string, to: string) =>
  useQuery({
    queryKey: ['lead-time', from, to],
    queryFn: () => getJson<LeadTime>('/accuracy/lead-time', { from, to }),
    staleTime: Infinity,
    enabled: !!from && !!to,
    placeholderData: keepPreviousData,
  })
