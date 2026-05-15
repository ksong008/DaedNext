import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd'
import { Check, ChevronDown, GripVertical, Trash2, Type, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { SimpleTooltip } from '~/components/ui/tooltip'
import { cn } from '~/lib/utils'

export function DroppableGroupCard({
  name,
  summary,
  collapsed,
  dragHandleProps,
  onToggleCollapsed,
  onRemove,
  onRename,
  actions,
  children,
}: {
  id: string
  name: string
  summary?: React.ReactNode
  collapsed?: boolean
  dragHandleProps?: DraggableProvidedDragHandleProps | null
  onToggleCollapsed?: () => void
  onRemove?: () => void
  onRename?: (newName: string) => void
  actions?: React.ReactNode
  children?: React.ReactNode
}) {
  const { t } = useTranslation()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  useEffect(() => {
    setEditValue(name)
  }, [name])

  const handleStartEdit = () => {
    setEditValue(name)
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setEditValue(name)
    setIsEditing(false)
  }

  const handleSaveEdit = () => {
    const trimmedValue = editValue.trim()
    if (trimmedValue && trimmedValue !== name) {
      onRename?.(trimmedValue)
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancelEdit()
    }
  }

  return (
    <>
      <Card
        withBorder
        shadow="sm"
        padding="sm"
        className="rounded-[22px] border-[color:var(--shell-line)] bg-[color:var(--shell-surface)]/96 shadow-[0_10px_24px_rgba(15,23,42,0.055)]"
      >
        <div className="border-b border-[color:var(--shell-line)]/80 pb-3">
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            {isEditing ? (
              <div className="mr-2 flex flex-1 items-center gap-2">
                <Input
                  ref={inputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleSaveEdit}
                  className="h-9 rounded-xl border-[color:var(--shell-line)] bg-[color:var(--shell-surface-soft)]/80 text-sm font-semibold"
                />
                <div className="flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--shell-line)] bg-[color:var(--shell-surface-soft)]/90 p-1">
                  <SimpleTooltip label={t('actions.confirm')}>
                    <Button variant="ghost" size="xs" onClick={handleSaveEdit} className="rounded-full">
                      <Check className="h-4 w-4 text-primary" />
                    </Button>
                  </SimpleTooltip>
                  <SimpleTooltip label={t('actions.cancel')}>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={handleCancelEdit}
                      onMouseDown={(e) => e.preventDefault()}
                      className="rounded-full"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </SimpleTooltip>
                </div>
              </div>
            ) : (
              <div className="min-w-0 flex-1">
                <h5 className="truncate text-base font-semibold text-foreground">{name}</h5>
                {summary && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {summary}
                  </div>
                )}
              </div>
            )}

            {!isEditing && (
              <div
                className="flex max-w-[52%] shrink-0 items-center gap-0.5 self-start overflow-x-auto rounded-full border border-[color:var(--shell-line)] bg-[color:var(--shell-surface-soft)]/90 p-0.5 [scrollbar-width:none] sm:max-w-full sm:gap-1 sm:p-1 [&_button]:h-7 [&_button]:w-7 [&_button]:shrink-0 [&_button]:p-0 [&_svg]:h-3.5 [&_svg]:w-3.5 sm:[&_button]:h-8 sm:[&_button]:w-8 sm:[&_svg]:h-4 sm:[&_svg]:w-4 [&::-webkit-scrollbar]:hidden"
                onPointerDown={(e) => e.stopPropagation()}
              >
                {dragHandleProps && (
                  <SimpleTooltip label={t('a11y.dragToReorder')}>
                    <div
                      className={cn(
                        'flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-full text-muted-foreground transition-colors sm:h-8 sm:w-8',
                        'hover:bg-accent/70 hover:text-foreground active:cursor-grabbing',
                      )}
                      {...dragHandleProps}
                    >
                      <GripVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </div>
                  </SimpleTooltip>
                )}
                {onRename && (
                  <SimpleTooltip label={t('actions.rename')}>
                    <Button variant="ghost" size="xs" onClick={handleStartEdit} className="rounded-full">
                      <Type className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </Button>
                  </SimpleTooltip>
                )}
                {actions}
                {onToggleCollapsed && (
                  <SimpleTooltip label={collapsed ? t('actions.expand') : t('collapse')}>
                    <Button variant="ghost" size="xs" onClick={onToggleCollapsed} className="rounded-full">
                      <ChevronDown
                        className={cn('h-3.5 w-3.5 transition-transform sm:h-4 sm:w-4', collapsed && '-rotate-90')}
                      />
                    </Button>
                  </SimpleTooltip>
                )}

                {onRemove && (
                  <SimpleTooltip label={t('actions.remove')}>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="rounded-full text-destructive hover:text-destructive"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => setConfirmOpen(true)}
                    >
                      <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </Button>
                  </SimpleTooltip>
                )}
              </div>
            )}
          </div>
        </div>

        {children && <div className="pt-3.5">{children}</div>}
      </Card>

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
                onRemove?.()
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
