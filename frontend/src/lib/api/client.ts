import type { components } from './schema'

export type DayAhead = components['schemas']['DayAhead']
export type DayRuns = components['schemas']['DayRuns']
export type Meta = components['schemas']['Meta']
export type Point = components['schemas']['Point']

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function getJson<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const query = new URLSearchParams(params).toString()
  const res = await fetch(`/api/v1${path}${query ? `?${query}` : ''}`)
  if (!res.ok) {
    // Problem+json carries a human-readable detail.
    const body = (await res.json().catch(() => null)) as { detail?: string } | null
    throw new ApiError(res.status, body?.detail ?? `Request failed (${res.status})`)
  }
  return (await res.json()) as T
}
