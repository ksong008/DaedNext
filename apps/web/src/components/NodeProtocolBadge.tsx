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
        'inline-flex min-w-[3.35rem] shrink-0 flex-col items-center justify-center rounded-full bg-[color:var(--shell-blue-soft)] px-1.5 py-0.5 text-center font-semibold uppercase leading-none text-[color:var(--shell-blue-strong)]',
        compact ? 'gap-[1px]' : 'gap-0.5 py-1',
        className,
      )}
    >
      {parts.protocol ? (
        <span className={cn('max-w-full truncate tracking-[0.08em]', compact ? 'text-[9px]' : 'text-[10px]')}>
          {parts.protocol}
        </span>
      ) : null}
      {parts.transport ? (
        <span
          className={cn(
            'max-w-full truncate font-medium tracking-[0.05em] opacity-[0.72]',
            compact ? 'text-[7px]' : 'text-[8px]',
          )}
        >
          {parts.transport}
        </span>
      ) : null}
    </span>
  )
}
