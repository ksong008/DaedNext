import type { DAEConfigFileIssue } from '~/apis/types'
import type { BundleChoiceDiff, BundleCollectionDiff, BundleDiffPreview } from '~/utils/bundle'
import { AlertTriangle, ArrowRight, CheckCircle2, FileJson2, Info, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'

interface BundleImportPreviewDialogProps {
  open: boolean
  fileName: string
  preview: BundleDiffPreview | null
  warnings?: DAEConfigFileIssue[]
  loading?: boolean
  title: string
  description: string
  fileLabel: string
  warningTitle: string
  warningDescription: string
  noChangesTitle: string
  noChangesDescription: string
  confirmLabel: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

function ChoiceDiffRow({ label, diff }: { label: string; diff: BundleChoiceDiff }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2 text-sm">
        <Badge variant="outline">{diff.current || '—'}</Badge>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <Badge variant={diff.changed ? 'default' : 'secondary'}>{diff.incoming || '—'}</Badge>
      </div>
    </div>
  )
}

function ChangeList({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) {
    return null
  }

  const visible = values.slice(0, 6)
  const hidden = values.length - visible.length

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((value) => (
          <Badge key={`${label}-${value}`} variant="outline" className="max-w-full truncate">
            {value}
          </Badge>
        ))}
        {hidden > 0 && <Badge variant="secondary">+{hidden}</Badge>}
      </div>
    </div>
  )
}

function ChangedDetailList({ label, values }: { label: string; values: BundleCollectionDiff['changedDetails'] }) {
  if (values.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="space-y-2">
        {values.map((value) => (
          <div key={value.label} className="rounded-md border bg-muted/20 px-3 py-2">
            <div className="text-sm font-medium">{value.label}</div>
            <div className="mt-2 space-y-1">
              {value.changes.map((change) => (
                <div key={`${value.label}-${change}`} className="text-xs font-mono text-muted-foreground break-all">
                  {change}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function WarningGroups({ warnings }: { warnings: DAEConfigFileIssue[] }) {
  const { t } = useTranslation()
  if (warnings.length === 0) {
    return null
  }

  const groups = [
    {
      key: 'lossy',
      title: t('warningsLossy'),
      icon: <AlertTriangle className="h-4 w-4" />,
      variant: 'destructive' as const,
      items: warnings.filter((warning) => warning.level === 'lossy'),
    },
    {
      key: 'warn',
      title: t('warningsWarn'),
      icon: <TriangleAlert className="h-4 w-4" />,
      variant: 'default' as const,
      items: warnings.filter((warning) => warning.level === 'warn'),
    },
    {
      key: 'info',
      title: t('warningsInfo'),
      icon: <Info className="h-4 w-4" />,
      variant: 'default' as const,
      items: warnings.filter((warning) => warning.level === 'info'),
    },
  ].filter((group) => group.items.length > 0)

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <Alert key={group.key} variant={group.variant}>
          {group.icon}
          <AlertTitle>{group.title}</AlertTitle>
          <AlertDescription>
            {group.items.map((warning) => (
              <p key={`${warning.code}-${warning.message}`}>{warning.message}</p>
            ))}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  )
}

function CollectionDiffCard({ diff }: { diff: BundleCollectionDiff }) {
  const { t } = useTranslation()
  const titleMap: Record<BundleCollectionDiff['key'], string> = {
    configs: t('config'),
    dnss: t('dns'),
    routings: t('routing'),
    subscriptions: t('subscription'),
    nodes: t('node'),
    groups: t('group'),
  }
  const changed = diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium">{titleMap[diff.key]}</div>
        <Badge variant={changed ? 'default' : 'secondary'}>
          {changed ? t('bundle.previewChanged') : t('bundle.previewUnchanged')}
        </Badge>
      </div>

      <ChangeList label={t('bundle.previewAdded')} values={diff.added} />
      <ChangeList label={t('bundle.previewRemoved')} values={diff.removed} />
      <ChangedDetailList label={t('bundle.previewChanged')} values={diff.changedDetails} />
    </div>
  )
}

export function BundleImportPreviewDialog({
  open,
  fileName,
  preview,
  warnings = [],
  loading = false,
  title,
  description,
  fileLabel,
  warningTitle,
  warningDescription,
  noChangesTitle,
  noChangesDescription,
  confirmLabel,
  onOpenChange,
  onConfirm,
}: BundleImportPreviewDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <FileJson2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{fileLabel}</span>
            <span className="font-medium break-all">{fileName}</span>
          </div>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{warningTitle}</AlertTitle>
            <AlertDescription>{warningDescription}</AlertDescription>
          </Alert>

          <WarningGroups warnings={warnings} />

          {preview && !preview.hasChanges && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>{noChangesTitle}</AlertTitle>
              <AlertDescription>{noChangesDescription}</AlertDescription>
            </Alert>
          )}

          {preview && (
            <>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">{t('bundle.previewModeTitle')}</h3>
                <ChoiceDiffRow label={t('bundle.previewMode')} diff={preview.mode} />
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold">{t('bundle.previewDefaultsTitle')}</h3>
                <div className="grid gap-2">
                  <ChoiceDiffRow label={t('config')} diff={preview.defaults.config} />
                  <ChoiceDiffRow label={t('dns')} diff={preview.defaults.dns} />
                  <ChoiceDiffRow label={t('routing')} diff={preview.defaults.routing} />
                  <ChoiceDiffRow label={t('group')} diff={preview.defaults.group} />
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold">{t('bundle.previewSelectedTitle')}</h3>
                <div className="grid gap-2">
                  <ChoiceDiffRow label={t('config')} diff={preview.selected.config} />
                  <ChoiceDiffRow label={t('dns')} diff={preview.selected.dns} />
                  <ChoiceDiffRow label={t('routing')} diff={preview.selected.routing} />
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold">{t('bundle.previewResourcesTitle')}</h3>
                <div className="grid gap-3 lg:grid-cols-2">
                  {preview.collections.map((collection) => (
                    <CollectionDiffCard key={collection.key} diff={collection} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('actions.cancel')}
          </Button>
          <Button variant="destructive" onClick={onConfirm} loading={loading} disabled={!preview}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
