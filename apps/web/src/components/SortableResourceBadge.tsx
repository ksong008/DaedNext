import type { DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd'
import { Draggable } from '@hello-pangea/dnd'
import { GripVertical, X } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { SimpleTooltip } from '~/components/ui/tooltip'
import { cn } from '~/lib/utils'
import { getInstantDropStyle } from '~/utils'

export function SortableResourceBadge({
  id,
  index,
  name,
  protocol,
  subtitle,
  address,
  meta,
  onRemove,
  children,
}: {
  id: string
  index: number
  name: string
  protocol?: string | null
  subtitle?: string | null
  address?: string | null
  meta?: React.ReactNode
  onRemove?: () => void
  children?: React.ReactNode
}) {
  const card = (provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      style={getInstantDropStyle(provided, snapshot)}
      className={cn(
        'group relative flex min-h-12 items-center gap-2.5 overflow-hidden rounded-[16px] border border-[color:var(--shell-line)] bg-[color:var(--shell-surface)]/90 px-3.5 py-3 select-none',
        'transition-[shadow,border-color,opacity,background-color] duration-200',
        'hover:border-primary/24 hover:bg-[color:var(--shell-surface-soft)]/92 hover:shadow-[0_10px_22px_rgba(15,23,42,0.06)]',
        snapshot.isDragging && 'z-10 opacity-92 shadow-lg ring-2 ring-primary/20',
      )}
    >
      <div
        className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-[12px] border border-[color:var(--shell-line)] bg-[color:var(--shell-surface-soft)]/88 p-1.5 touch-none active:cursor-grabbing"
        {...provided.dragHandleProps}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/45 transition-colors group-hover:text-muted-foreground/70" />
      </div>

      {protocol && (
        <span className="shrink-0 rounded-full bg-[color:var(--shell-blue-soft)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--shell-blue-strong)]">
          {protocol}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-foreground">{name}</span>
        {subtitle && <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{subtitle}</span>}
        {address && <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{address}</span>}
      </div>

      {meta && (
        <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
          {meta}
        </span>
      )}

      {onRemove && (
        <Button
          variant="ghost"
          size="xs"
          className="h-7 w-7 shrink-0 rounded-full border border-transparent p-0 text-muted-foreground transition-opacity hover:border-destructive/10 hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  )

  return (
    <Draggable draggableId={id} index={index}>
      {(provided, snapshot) => {
        const cardElement = card(provided, snapshot)
        if (children) {
          return <SimpleTooltip label={<span className="text-xs">{children}</span>}>{cardElement}</SimpleTooltip>
        }
        return cardElement
      }}
    </Draggable>
  )
}
