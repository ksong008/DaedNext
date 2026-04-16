import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import { Dialog, DialogTitle } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import {
  ScrollableDialogBody,
  ScrollableDialogContent,
  ScrollableDialogFooter,
  ScrollableDialogHeader,
} from '~/components/ui/scrollable-dialog'
import { cn } from '~/lib/utils'

export interface GroupPickerItem {
  id: string
  title: string
  description?: string
  meta?: string
  badge?: string
  keywords?: string[]
}

interface SelectionDialogProps {
  opened: boolean
  onClose: () => void
  title: string
  searchPlaceholder: string
  emptyLabel: string
  noResultsLabel: string
  submitLabel: string
  loading?: boolean
  items: GroupPickerItem[]
  resetKey: string
  onSubmit: (ids: string[]) => Promise<void>
}

function SelectionDialog({
  opened,
  onClose,
  title,
  searchPlaceholder,
  emptyLabel,
  noResultsLabel,
  submitLabel,
  loading,
  items,
  resetKey,
  onSubmit,
}: SelectionDialogProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    setQuery('')
    setSelectedIds([])
  }, [opened, resetKey])

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) return items

    return items.filter((item) =>
      [item.title, item.description, item.meta, ...(item.keywords || [])]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery)),
    )
  }, [items, query])

  const selectedCount = selectedIds.length

  const toggleItem = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]))
  }

  const handleClose = () => {
    onClose()
    setQuery('')
    setSelectedIds([])
  }

  const handleSubmit = async () => {
    if (selectedCount === 0) return

    await onSubmit(selectedIds)
    handleClose()
  }

  return (
    <Dialog open={opened} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <ScrollableDialogContent size="lg">
        <ScrollableDialogHeader>
          <div className="pr-8">
            <DialogTitle>{title}</DialogTitle>
            <p className="mt-2 text-sm text-muted-foreground">{t('groupPicker.selectedCount', { count: selectedCount })}</p>
          </div>
        </ScrollableDialogHeader>

        <ScrollableDialogBody className="flex flex-col gap-4">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            icon={<Search className="h-4 w-4" />}
          />

          <div className="flex flex-col gap-3">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => {
                const checked = selectedIds.includes(item.id)

                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={checked}
                    className={cn(
                      'cursor-pointer rounded-lg border p-3 transition-colors outline-none',
                      'hover:border-primary/30 hover:bg-accent/40',
                      checked && 'border-primary bg-primary/5',
                    )}
                    onClick={() => toggleItem(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        toggleItem(item.id)
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={checked}
                        className="mt-1"
                        onCheckedChange={() => toggleItem(item.id)}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium break-words">{item.title}</p>
                          {item.badge && (
                            <span className="inline-flex rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                              {item.badge}
                            </span>
                          )}
                        </div>

                        {item.description && <p className="mt-1 break-all text-xs text-muted-foreground">{item.description}</p>}
                        {item.meta && <p className="mt-1 text-[11px] text-muted-foreground">{item.meta}</p>}
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {query.trim() ? noResultsLabel : emptyLabel}
              </p>
            )}
          </div>
        </ScrollableDialogBody>

        <ScrollableDialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            {t('actions.cancel')}
          </Button>
          <Button onClick={handleSubmit} loading={loading} disabled={selectedCount === 0 || loading}>
            {submitLabel}
          </Button>
        </ScrollableDialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  )
}

export function GroupAddNodesModal({
  opened,
  onClose,
  groupName,
  items,
  loading,
  resetKey,
  onSubmit,
}: {
  opened: boolean
  onClose: () => void
  groupName: string
  items: GroupPickerItem[]
  loading?: boolean
  resetKey: string
  onSubmit: (ids: string[]) => Promise<void>
}) {
  const { t } = useTranslation()

  return (
    <SelectionDialog
      opened={opened}
      onClose={onClose}
      title={t('groupPicker.addNodesTitle', { name: groupName })}
      searchPlaceholder={t('groupPicker.searchNodesPlaceholder')}
      emptyLabel={t('groupPicker.noAvailableNodes')}
      noResultsLabel={t('groupPicker.noSearchResults')}
      submitLabel={t('groupPicker.addSelectedNodes')}
      items={items}
      loading={loading}
      resetKey={resetKey}
      onSubmit={onSubmit}
    />
  )
}

export function GroupAddSubscriptionsModal({
  opened,
  onClose,
  groupName,
  items,
  loading,
  resetKey,
  onSubmit,
}: {
  opened: boolean
  onClose: () => void
  groupName: string
  items: GroupPickerItem[]
  loading?: boolean
  resetKey: string
  onSubmit: (ids: string[]) => Promise<void>
}) {
  const { t } = useTranslation()

  return (
    <SelectionDialog
      opened={opened}
      onClose={onClose}
      title={t('groupPicker.addSubscriptionsTitle', { name: groupName })}
      searchPlaceholder={t('groupPicker.searchSubscriptionsPlaceholder')}
      emptyLabel={t('groupPicker.noAvailableSubscriptions')}
      noResultsLabel={t('groupPicker.noSearchResults')}
      submitLabel={t('groupPicker.addSelectedSubscriptions')}
      items={items}
      loading={loading}
      resetKey={resetKey}
      onSubmit={onSubmit}
    />
  )
}
