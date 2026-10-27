import { useEffect, useState } from 'react'

type Health = { status: 'ok'; version: string; python: string }

type ApiState =
  | { kind: 'loading' }
  | { kind: 'ok'; health: Health }
  | { kind: 'error'; message: string }

function useHealth(): ApiState {
  const [state, setState] = useState<ApiState>({ kind: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/v1/health', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<Health>
      })
      .then((health) => setState({ kind: 'ok', health }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
      })
    return () => controller.abort()
  }, [])

  return state
}

export default function App() {
  const api = useHealth()

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 16px' }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Beaufort</h1>
      <p
        role="status"
        style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: '1px solid var(--hairline)',
          color: 'var(--ink-muted)',
        }}
      >
        {api.kind === 'loading' && 'Connecting to API…'}
        {api.kind === 'ok' && (
          <>
            <span style={{ color: 'var(--ok)' }}>● API online</span> · v{api.health.version} ·
            Python {api.health.python}
          </>
        )}
        {api.kind === 'error' && (
          <span style={{ color: 'var(--fail)' }}>● API unreachable ({api.message})</span>
        )}
      </p>
    </main>
  )
}
