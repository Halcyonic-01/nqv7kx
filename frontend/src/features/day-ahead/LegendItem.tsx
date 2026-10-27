type Key = { kind: 'line'; color: string; dashed?: boolean } | { kind: 'area'; color: string }

type Props = {
  label: string
  swatch: Key
  /** Present for toggleable layers. */
  pressed?: boolean
  onToggle?: () => void
}

function Swatch({ swatch, off }: { swatch: Key; off: boolean }) {
  const style =
    swatch.kind === 'line'
      ? { borderTop: `2px ${swatch.dashed ? 'dashed' : 'solid'} ${swatch.color}`, height: 0, width: 14 }
      : { background: swatch.color, height: 10, width: 14, borderRadius: 2 }
  return <span aria-hidden className={`inline-block ${off ? 'opacity-30' : ''}`} style={style} />
}

export function LegendItem({ label, swatch, pressed, onToggle }: Props) {
  const content = (
    <>
      <Swatch swatch={swatch} off={pressed === false} />
      <span>{label}</span>
    </>
  )
  if (!onToggle) return <span className="inline-flex items-center gap-2 px-1 text-[12px] text-ink-2">{content}</span>
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={`inline-flex items-center gap-2 rounded-md border px-2 py-0.5 text-[12px] transition-colors ${
        pressed ? 'border-hairline bg-raised text-ink' : 'border-transparent text-muted hover:bg-hover hover:text-ink-2'
      }`}
    >
      {content}
    </button>
  )
}
