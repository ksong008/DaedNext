import { cn } from '~/lib/utils'
import { formatNodeProtocolParts } from '~/utils/node_display'

export function NodeProtocolBadge({
  protocol,
  transport,
  compact,
  className,
}: {
  protocol?: string | null
  transport?: string | null
  compact?: boolean
  className?: string
}) {
  const parts = formatNodeProtocolParts(protocol, transport)

  if (!parts) {
    return null
  }

  return (
    <span
      className={cn(
        'inline-flex min-w-[3.7rem] shrink-0 flex-col items-center justify-center rounded-full bg-[color:var(--shell-blue-soft)] px-2 py-1 text-center font-semibold uppercase leading-none text-[color:var(--shell-blue-strong)]',
        compact ? 'gap-0.5 text-[8.5px]' : 'gap-1 text-[9.5px]',
        className,
      )}
    >
      {parts.protocol ? <span className="max-w-full truncate tracking-[0.12em]">{parts.protocol}</span> : null}
      {parts.transport ? (
        <span className="max-w-full truncate tracking-[0.08em] opacity-75">{parts.transport}</span>
      ) : null}
    </span>
  )
}
