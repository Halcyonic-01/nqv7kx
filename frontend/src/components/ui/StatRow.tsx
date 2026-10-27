export type Stat = { label: string; value: string; detail?: string }

/** One row of headline figures with hairline dividers; wraps to a grid on small screens. */
export function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-y border-hairline py-4 sm:grid-cols-3 lg:grid-flow-col lg:auto-cols-fr lg:grid-cols-none lg:gap-x-0">
      {stats.map((s, i) => (
        <div key={s.label} className={i > 0 ? 'lg:border-l lg:border-hairline lg:px-4' : 'lg:pr-4'}>
          <dt className="text-[12px] text-muted">{s.label}</dt>
          <dd className="mt-0.5 text-[22px] font-semibold tracking-tight">{s.value}</dd>
          {s.detail && <dd className="text-[12px] text-ink-2">{s.detail}</dd>}
        </div>
      ))}
    </dl>
  )
}
