import type { DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd'
import { Draggable } from '@hello-pangea/dnd'
import { GripVertical, X } from 'lucide-react'
import { NodeProtocolBadge } from '~/components/NodeProtocolBadge'
import { Button } from '~/components/ui/button'
import { SimpleTooltip } from '~/components/ui/tooltip'
import { cn } from '~/lib/utils'
import { getInstantDropStyle } from '~/utils'

export function SortableResourceBadge({
  id,
  index,
  name,
  protocol,
  transport,
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
  transport?: string | null
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
        'group relative grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-2.5 gap-y-2 overflow-hidden rounded-[16px] border border-[color:var(--shell-line)] bg-[color:var(--shell-surface)]/90 px-3 py-2.5 select-none sm:flex sm:items-center sm:gap-2.5 sm:px-3.5 sm:py-3',
        'transition-[shadow,border-color,opacity,background-color] duration-200',
        'hover:border-primary/24 hover:bg-[color:var(--shell-surface-soft)]/92 hover:shadow-[0_10px_22px_rgba(15,23,42,0.06)]',
        snapshot.isDragging && 'z-10 opacity-92 shadow-lg ring-2 ring-primary/20',
      )}
    >
      <div
        className="row-span-2 flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-[12px] border border-[color:var(--shell-line)] bg-[color:var(--shell-surface-soft)]/88 p-1.5 touch-none active:cursor-grabbing sm:row-auto"
        {...provided.dragHandleProps}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/45 transition-colors group-hover:text-muted-foreground/70" />
      </div>

      <div className="col-start-2 flex min-w-0 items-start gap-2 sm:flex-1 sm:items-center">
        <NodeProtocolBadge
          protocol={protocol}
          transport={transport}
          compact
          className="mt-0.5 max-w-[4.6rem] sm:mt-0 sm:max-w-[5rem]"
        />

        <div className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-foreground">{name}</span>
          {subtitle && <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{subtitle}</span>}
          {address && <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{address}</span>}
        </div>
      </div>

      {meta && (
        <span className="col-start-2 col-end-4 row-start-2 w-fit max-w-full truncate rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 sm:col-auto sm:row-auto sm:ml-auto sm:shrink-0">
          {meta}
        </span>
      )}

      {onRemove && (
        <Button
          variant="ghost"
          size="xs"
          className="col-start-3 row-start-1 h-8 w-8 shrink-0 rounded-full border border-transparent p-0 text-muted-foreground transition-opacity hover:border-destructive/10 hover:bg-destructive/10 hover:text-destructive sm:order-last sm:h-7 sm:w-7 sm:opacity-0 sm:group-hover:opacity-100"
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
