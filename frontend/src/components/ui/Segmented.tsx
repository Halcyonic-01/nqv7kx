type Option = { value: string; label: string; hint?: string }

type Props = {
  label: string
  options: Option[]
  value: string
  onChange: (value: string) => void
}

export function Segmented({ label, options, value, onChange }: Props) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-md border border-hairline bg-page p-0.5">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            aria-label={o.hint ? `${o.label} ${o.hint}` : o.label}
            onClick={() => onChange(o.value)}
            className={`flex items-baseline gap-1.5 rounded-[5px] px-2 py-1 text-[13px] sm:px-2.5 transition-colors ${
              active ? 'bg-raised text-ink shadow-[0_0_0_1px_var(--hairline)]' : 'text-ink-2 hover:bg-hover'
            }`}
          >
            <span className={active ? 'font-medium' : ''}>{o.label}</span>
            {o.hint && <span className="hidden text-muted tabular-nums sm:inline">{o.hint}</span>}
          </button>
        )
      })}
    </div>
  )
}
