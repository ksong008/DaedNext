import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button'
import { SimpleTooltip } from '~/components/ui/tooltip'
import { cn } from '~/lib/utils'

export function Section({
  title,
  icon,
  bordered,
  iconPlus,
  onCreate,
  actions,
  highlight,
  children,
  className,
}: {
  title: string
  icon?: React.ReactNode
  bordered?: boolean
  iconPlus?: React.ReactNode
  onCreate: () => void
  actions?: React.ReactNode
  highlight?: boolean
  children: React.ReactNode
  className?: string
}) {
  const { t } = useTranslation()

  return (
    <div
      data-testid="section"
      className={cn(
        'resource-section flex flex-col gap-5 rounded-xl border border-border bg-card p-4 sm:p-6',
        bordered && 'hover:border-primary/30',
        highlight && 'border-primary/30 bg-[color-mix(in_oklab,var(--primary)_7%,var(--card))]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:var(--shell-line)] bg-[color:var(--shell-surface-soft)] text-primary shadow-sm">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h4 className="truncate text-base font-semibold text-foreground sm:text-lg">{title}</h4>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {actions}
          <SimpleTooltip label={t('actions.add')}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('actions.add')}
              className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
              onClick={onCreate}
            >
              {iconPlus || <Plus className="h-4 w-4" />}
            </Button>
          </SimpleTooltip>
        </div>
      </div>

      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}
