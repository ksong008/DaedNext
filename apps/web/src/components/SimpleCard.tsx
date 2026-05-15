import { Check, Copy, Eye, Trash2, Type, X } from 'lucide-react'
import { Fragment, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import {
  ScrollableDialogBody,
  ScrollableDialogContent,
  ScrollableDialogHeader,
} from '~/components/ui/scrollable-dialog'
import { SimpleTooltip } from '~/components/ui/tooltip'
import { cn } from '~/lib/utils'

export function SimpleCard({
  name,
  selected,
  onSelect,
  onRemove,
  onRename,
  onDuplicate,
  actions,
  inlineContent,
  detailsContent,
  children,
}: {
  name: string
  selected: boolean
  onSelect?: () => void
  onRemove?: () => void
  onRename?: (newName: string) => void
  onDuplicate?: () => void
  actions?: React.ReactNode
  inlineContent?: React.ReactNode
  detailsContent?: React.ReactNode
  children?: React.ReactNode
}) {
  const { t } = useTranslation()
  const [openedDetailsModal, setOpenedDetailsModal] = useState(false)
  const [openedConfirmModal, setOpenedConfirmModal] = useState(false)
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

  const renderedInlineContent = inlineContent ?? children
  const renderedDetailsContent = detailsContent ?? renderedInlineContent

  return (
    <Fragment>
      <Card
        withBorder
        shadow="sm"
        padding="none"
        className={cn(
          'overflow-hidden rounded-[22px] border-[color:var(--shell-line)] bg-[color:var(--shell-surface)] shadow-[0_10px_24px_color-mix(in_oklab,var(--foreground)_6%,transparent)] transition-[border-color,box-shadow,transform] duration-200 hover:border-primary/18 hover:shadow-[0_16px_32px_color-mix(in_oklab,var(--foreground)_8%,transparent)]',
          selected &&
            'border-primary/30 bg-[color-mix(in_oklab,var(--primary)_6%,var(--card))] ring-2 ring-primary/12 ring-offset-2 ring-offset-background',
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[color:var(--shell-line)]/80 px-3.5 py-3">
          {isEditing ? (
            <div className="flex flex-1 items-center gap-2">
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
            <button
              type="button"
              className={cn(
                'flex flex-1 items-center gap-2.5 rounded-[18px] px-0.5 py-0.5 text-left transition-colors',
                selected ? 'text-primary' : 'hover:text-foreground',
              )}
              onClick={onSelect}
            >
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] border text-xs font-semibold transition-colors',
                  selected
                    ? 'border-primary/25 bg-primary/10 text-primary'
                    : 'border-[color:var(--shell-line)] bg-[color:var(--shell-surface-soft)]/80 text-[var(--shell-muted)]',
                )}
              >
                {selected ? <Check className="h-4 w-4" strokeWidth={3} /> : name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h4 className={cn('truncate text-sm font-semibold text-foreground', selected && 'text-primary')}>
                  {name}
                </h4>
              </div>
            </button>
          )}

          {!isEditing && (
            <div className="flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--shell-line)] bg-[color:var(--shell-surface-soft)]/90 p-1">
              {onRename && (
                <SimpleTooltip label={t('actions.rename')}>
                  <Button variant="ghost" size="xs" onClick={handleStartEdit} className="rounded-full">
                    <Type className="h-4 w-4" />
                  </Button>
                </SimpleTooltip>
              )}

              {onDuplicate && (
                <SimpleTooltip label={t('actions.duplicate')}>
                  <Button variant="ghost" size="xs" onClick={onDuplicate} className="rounded-full">
                    <Copy className="h-4 w-4" />
                  </Button>
                </SimpleTooltip>
              )}

              {actions}

              {renderedDetailsContent && (
                <SimpleTooltip label={t('actions.viewDetails')}>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setOpenedDetailsModal(true)}
                    className="rounded-full"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </SimpleTooltip>
              )}

              {!selected && onRemove && (
                <SimpleTooltip label={t('actions.remove')}>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="rounded-full text-destructive hover:text-destructive"
                    onClick={() => setOpenedConfirmModal(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </SimpleTooltip>
              )}
            </div>
          )}
        </div>

        {renderedInlineContent && <div className="px-3.5 py-3.5">{renderedInlineContent}</div>}
      </Card>

      <Dialog open={openedDetailsModal} onOpenChange={setOpenedDetailsModal}>
        <ScrollableDialogContent size="lg">
          <ScrollableDialogHeader>
            <DialogTitle>{name}</DialogTitle>
          </ScrollableDialogHeader>
          <ScrollableDialogBody>{renderedDetailsContent}</ScrollableDialogBody>
        </ScrollableDialogContent>
      </Dialog>

      <Dialog open={openedConfirmModal} onOpenChange={setOpenedConfirmModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('actions.remove')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('confirmModal.removeConfirmDescription')}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenedConfirmModal(false)}>
              {t('confirmModal.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onRemove?.()
                setOpenedConfirmModal(false)
              }}
            >
              {t('confirmModal.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Fragment>
  )
}
