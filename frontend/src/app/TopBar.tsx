import { NavLink, useSearchParams } from 'react-router'
import { Segmented } from '../components/ui/Segmented'
import { useMeta } from '../lib/api/queries'
import { useGateClosure } from '../lib/url-state'
import { DataPopover } from './DataPopover'

const FALLBACK_PRESETS = [
  { id: 'epex', label: 'EPEX GB 60-min', time: '09:20' },
  { id: 'n2ex', label: 'N2EX', time: '09:50' },
]

function Mark() {
  return (
    <svg viewBox="0 0 32 32" className="size-6" aria-hidden>
      <rect width="32" height="32" rx="7" fill="var(--fc)" />
      <path d="M8 11h12M8 16h16M8 21h9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export function TopBar() {
  const { data: meta } = useMeta()
  const [gateClosure, setGateClosure] = useGateClosure()
  const [params] = useSearchParams()
  const presets = meta?.gate_closures ?? FALLBACK_PRESETS
  const search = params.toString() ? `?${params}` : ''

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-page/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <NavLink to={`/${search}`} className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
          <Mark />
          Beaufort
        </NavLink>
        <nav className="flex items-center gap-1 text-[13px]">
          <NavLink
            to={`/day-ahead${search}`}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-md px-2.5 py-1 ${isActive ? 'bg-hover font-medium text-ink' : 'text-ink-2 hover:text-ink'}`
            }
          >
            Day-ahead
          </NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-[13px] text-muted md:inline">Gate closure</span>
          <Segmented
            label="Gate closure"
            value={gateClosure}
            onChange={setGateClosure}
            options={presets.map((p) => ({
              value: p.time,
              label: p.id === 'epex' ? 'EPEX' : p.id.toUpperCase(),
              hint: p.time,
            }))}
          />
          <span className="hidden sm:inline">
            <DataPopover />
          </span>
        </div>
      </div>
    </header>
  )
}
