import * as Popover from '@radix-ui/react-popover'
import { useState } from 'react'
import { periodLabel, presets } from './periods'

type Props = { first: string; last: string; from: string; to: string; onChange: (from: string, to: string) => void }

export function PeriodPicker({ first, last, from, to, onChange }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="rounded-md border border-hairline px-3 py-1 text-[14px] font-semibold tracking-tight hover:bg-hover">
        {periodLabel(from, to)} <span className="ml-1 text-muted">▾</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[240px] rounded-lg border border-hairline bg-raised p-1 shadow-lg shadow-black/5"
        >
          <ul role="listbox" aria-label="Period">
            {presets(first, last).map((p) => {
              const selected = p.from === from && p.to === to
              return (
                <li key={`${p.from}${p.to}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onChange(p.from, p.to)
                      setOpen(false)
                    }}
                    className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-hover"
                  >
                    <span className={selected ? 'font-semibold' : ''}>{p.label}</span>
                    {selected && <span aria-hidden className="text-[15px] font-bold">✓</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
