type Props = { message: string; onRetry: () => void }

export function ErrorState({ message, onRetry }: Props) {
  return (
    <div role="alert" className="flex items-center justify-between gap-4 rounded-md border border-hairline px-4 py-3">
      <span className="text-ink-2">{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md border border-hairline px-3 py-1 text-[13px] font-medium hover:bg-hover"
      >
        Retry
      </button>
    </div>
  )
}
