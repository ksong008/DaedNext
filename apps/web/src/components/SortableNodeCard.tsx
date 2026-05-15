import type { DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd'
import { Draggable } from '@hello-pangea/dnd'
import { GripVertical, Trash2 } from 'lucide-react'
import * as React from 'react'
import { useState } from 'react'

import { useTranslation } from 'react-i18next'
import { NodeProtocolBadge } from '~/components/NodeProtocolBadge'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { SimpleTooltip } from '~/components/ui/tooltip'
import { cn } from '~/lib/utils'
import { getInstantDropStyle } from '~/utils'

export function SortableNodeCard({
  id,
  index,
  name,
  protocol,
  transport,
  subtitle,
  onRemove,
  actions,
  children,
}: {
  id: string
  index: number
  name: React.ReactNode
  protocol?: string | null
  transport?: string | null
  subtitle?: React.ReactNode
  onRemove: () => void
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <>
      <Draggable draggableId={id} index={index}>
        {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
          <div
            ref={provided.innerRef}
            data-testid="node-card"
            {...provided.draggableProps}
            style={getInstantDropStyle(provided, snapshot)}
            className={cn(
              'group relative rounded-[22px] border border-[color:var(--shell-line)] bg-[color:var(--shell-surface)]/96',
              'transition-[shadow,border-color,opacity,transform] duration-200',
              'hover:border-primary/18 hover:shadow-[0_16px_34px_rgba(15,23,42,0.085)]',
              snapshot.isDragging && 'z-50 opacity-92 shadow-[0_18px_36px_rgba(15,23,42,0.18)]',
            )}
          >
            <div
              className="absolute left-2.5 top-3 flex h-7 w-7 cursor-grab touch-none items-center justify-center rounded-[10px] border border-[color:var(--shell-line)] bg-[color:var(--shell-surface-soft)]/88 active:cursor-grabbing sm:left-3 sm:top-4 sm:h-8 sm:w-8 sm:rounded-[12px]"
              {...provided.dragHandleProps}
            >
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground/55 transition-colors group-hover:text-muted-foreground sm:h-4 sm:w-4" />
            </div>

            <div className="p-3 pl-12 sm:p-4 sm:pl-14">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-2.5">
                  <NodeProtocolBadge
                    protocol={protocol}
                    transport={transport}
                    compact
                    className="mt-0.5 max-w-[4.25rem] sm:max-w-[5rem]"
                  />
                  <div className="min-w-0 flex-1 pt-0.5">
                    <h4 className="text-sm font-semibold text-foreground [overflow-wrap:anywhere] sm:truncate">
                      {name}
                    </h4>
                    {subtitle && <p className="mt-1 truncate text-xs font-medium text-muted-foreground">{subtitle}</p>}
                  </div>
                </div>

                <div
                  className="flex max-w-full shrink-0 self-end overflow-x-auto rounded-full border border-[color:var(--shell-line)] bg-[color:var(--shell-surface-soft)]/90 p-0.5 transition-opacity [scrollbar-width:none] sm:gap-1 sm:p-1 sm:opacity-0 sm:group-hover:opacity-100 [&_button]:h-7 [&_button]:w-7 [&_button]:shrink-0 [&_button]:p-0 [&_svg]:h-3.5 [&_svg]:w-3.5 sm:[&_button]:h-8 sm:[&_button]:w-8 sm:[&_svg]:h-4 sm:[&_svg]:w-4 [&::-webkit-scrollbar]:hidden"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {actions}
                  <SimpleTooltip label={t('actions.remove')}>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="rounded-full text-muted-foreground hover:text-destructive"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => setConfirmOpen(true)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </SimpleTooltip>
                </div>
              </div>

              <div className="border-t border-[color:var(--shell-line)]/75 pt-3 text-sm text-muted-foreground">
                {children}
              </div>
            </div>
          </div>
        )}
      </Draggable>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('actions.remove')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('confirmModal.removeConfirmDescription')}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {t('confirmModal.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onRemove()
                setConfirmOpen(false)
              }}
            >
              {t('confirmModal.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
