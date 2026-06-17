import type { LogEntry } from '~/apis'
import { useStore } from '@nanostores/react'
import { FileText, RefreshCw, Search, Settings2, Trash2 } from 'lucide-react'
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  buildLogEventsURL,
  useClearLogsMutation,
  useLogSettingsQuery,
  useLogsQuery,
  useRuntimeLogLevelQuery,
  useSetRuntimeLogLevelMutation,
  useUpdateLogSettingsMutation,
} from '~/apis'
import { subscribeEventStream } from '~/apis/event_stream'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Select } from '~/components/ui/select'
import { Switch } from '~/components/ui/switch'
import { SimpleTooltip } from '~/components/ui/tooltip'
import { cn } from '~/lib/utils'
import { isMockMode } from '~/mocks'
import { endpointURLAtom, tokenAtom } from '~/store'

const runtimeLevelOptions = ['error', 'warn', 'info', 'debug', 'trace'] as const
const queryLevelOptions = ['all', ...runtimeLevelOptions] as const
const maxRenderedEntries = 500
const searchDebounceMs = 300

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${Math.round(value / 1024 / 1024)} MB`
}

function levelTone(level: string) {
  switch (level) {
    case 'panic':
    case 'fatal':
    case 'error':
      return 'text-destructive'
    case 'warning':
    case 'warn':
      return 'text-amber-600 dark:text-amber-300'
    case 'debug':
      return 'text-sky-600 dark:text-sky-300'
    case 'trace':
      return 'text-violet-600 dark:text-violet-300'
    default:
      return 'text-primary'
  }
}

function displayLevel(level: string) {
  return level === 'warning' ? 'warn' : level
}

function entryFields(entry: LogEntry) {
  return Object.entries(entry.fields ?? {})
}

function displayFieldValue(value: string) {
  return value === '' ? '-' : value
}

function canonicalLogLevel(level: string) {
  const normalized = level.trim().toLowerCase()
  return normalized === 'warning' ? 'warn' : normalized
}

function logEntryMatchesFilter(entry: LogEntry, level: string, query: string) {
  const normalizedLevel = canonicalLogLevel(level)
  if (normalizedLevel !== '' && normalizedLevel !== 'all' && canonicalLogLevel(entry.level) !== normalizedLevel) {
    return false
  }

  const normalizedQuery = query.trim().toLowerCase()
  if (normalizedQuery === '') return true
  if (entry.message.toLowerCase().includes(normalizedQuery)) return true

  return Object.entries(entry.fields ?? {}).some(([key, value]) => {
    return key.toLowerCase().includes(normalizedQuery) || value.toLowerCase().includes(normalizedQuery)
  })
}

function formatLogTime(timestamp: string) {
  const date = new Date(timestamp)
  if (!Number.isNaN(date.getTime())) {
    const twoDigits = (value: number) => value.toString().padStart(2, '0')
    return `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}:${twoDigits(date.getSeconds())}`
  }
  return timestamp
}

const LogEntryItem = memo(({ entry }: { entry: LogEntry }) => {
  const fields = entryFields(entry)
  return (
    <div className="rounded-lg border border-[color:var(--shell-line)]/60 bg-[color:var(--shell-surface)]/72 px-2.5 py-2 sm:grid sm:grid-cols-[5.5rem_4.5rem_minmax(0,1fr)] sm:gap-2">
      <div className="flex min-w-0 items-center gap-2 sm:contents">
        <span className="shrink-0 text-muted-foreground">{formatLogTime(entry.ts)}</span>
        <span
          className={cn(
            'shrink-0 rounded-md border border-current/20 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none sm:border-0 sm:px-0 sm:py-0 sm:text-xs sm:leading-relaxed',
            levelTone(entry.level),
          )}
        >
          {displayLevel(entry.level)}
        </span>
      </div>
      <div className="mt-1 min-w-0 text-foreground sm:mt-0">
        <div className="break-words">{entry.message}</div>
        {fields.length > 0 ? (
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-[10.5px] leading-snug text-muted-foreground sm:text-[11px]">
            {fields.map(([key, value]) => {
              const displayValue = displayFieldValue(value)
              return (
                <span
                  key={key}
                  title={`${key}=${displayValue}`}
                  className="inline-flex max-w-full min-w-0 items-baseline rounded-md border border-[color:var(--shell-line)]/55 bg-[color:var(--shell-surface-soft)]/56 px-1.5 py-0.5"
                >
                  <span className="shrink-0 text-muted-foreground/75">{key}=</span>
                  <span className="min-w-0 break-all text-muted-foreground">{displayValue}</span>
                </span>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
})

export function LogResource() {
  const { t } = useTranslation()
  const endpointURL = useStore(endpointURLAtom)
  const token = useStore(tokenAtom)
  const [queryLevel, setQueryLevel] = useState('all')
  const [searchDraft, setSearchDraft] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsEntries, setSettingsEntries] = useState('')
  const [settingsMaxMb, setSettingsMaxMb] = useState('')
  const logViewportRef = useRef<HTMLDivElement>(null)
  const pendingEntriesRef = useRef<LogEntry[]>([])
  const flushFrameRef = useRef<number | null>(null)
  const knownEntryIdsRef = useRef<Set<number>>(new Set())

  const logsQuery = useLogsQuery({ level: queryLevel, query: appliedSearch })
  const settingsQuery = useLogSettingsQuery()
  const runtimeLevelQuery = useRuntimeLogLevelQuery()
  const setRuntimeLogLevelMutation = useSetRuntimeLogLevelMutation()
  const clearLogsMutation = useClearLogsMutation()
  const updateLogSettingsMutation = useUpdateLogSettingsMutation()
  const [entries, setEntries] = useState<LogEntry[]>([])
  const runtimeLevel = runtimeLevelQuery.data?.level || 'info'

  useEffect(() => {
    const queriedEntries = logsQuery.data?.items ?? []
    pendingEntriesRef.current = []
    if (flushFrameRef.current !== null) {
      window.cancelAnimationFrame(flushFrameRef.current)
      flushFrameRef.current = null
    }
    knownEntryIdsRef.current = new Set(queriedEntries.map((entry) => entry.id))
    setEntries(queriedEntries)
  }, [logsQuery.data?.items])

  useEffect(() => {
    if (!settingsQuery.data) return
    setSettingsEntries(String(settingsQuery.data.maxEntries))
    setSettingsMaxMb(String(Math.round(settingsQuery.data.maxBytes / 1024 / 1024)))
  }, [settingsQuery.data])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedSearch(searchDraft.trim())
    }, searchDebounceMs)
    return () => window.clearTimeout(timer)
  }, [searchDraft])

  const streamURL = useMemo(() => {
    if (isMockMode() || !token || typeof fetch === 'undefined') return null
    return buildLogEventsURL(endpointURL, queryLevel, appliedSearch)
  }, [appliedSearch, endpointURL, queryLevel, token])

  useEffect(() => {
    if (!streamURL) return

    const flushPendingEntries = () => {
      flushFrameRef.current = null
      const pendingEntries = pendingEntriesRef.current
      if (pendingEntries.length === 0) return
      pendingEntriesRef.current = []

      setEntries((current) => {
        const next = [...current, ...pendingEntries]
        const trimmed = next.length > maxRenderedEntries ? next.slice(next.length - maxRenderedEntries) : next
        knownEntryIdsRef.current = new Set(trimmed.map((entry) => entry.id))
        return trimmed
      })
    }

    const scheduleFlush = () => {
      if (flushFrameRef.current !== null) return
      flushFrameRef.current = window.requestAnimationFrame(flushPendingEntries)
    }

    const handleEntry = (data: string) => {
      try {
        const entry = JSON.parse(data) as LogEntry
        if (!logEntryMatchesFilter(entry, queryLevel, appliedSearch)) return
        if (knownEntryIdsRef.current.has(entry.id)) return
        knownEntryIdsRef.current.add(entry.id)
        pendingEntriesRef.current.push(entry)
        scheduleFlush()
      } catch {
        // Ignore malformed stream messages.
      }
    }

    const unsubscribe = subscribeEventStream({
      url: streamURL,
      token,
      onMessage(message) {
        if (message.event === 'log.entry') {
          handleEntry(message.data)
        }
      },
    })

    return () => {
      unsubscribe()
      pendingEntriesRef.current = []
      if (flushFrameRef.current !== null) {
        window.cancelAnimationFrame(flushFrameRef.current)
        flushFrameRef.current = null
      }
    }
  }, [appliedSearch, queryLevel, streamURL, token])

  useLayoutEffect(() => {
    if (!autoScroll || !logViewportRef.current) return
    logViewportRef.current.scrollTop = logViewportRef.current.scrollHeight
  }, [autoScroll, entries])

  const logLevelLabels: Record<(typeof runtimeLevelOptions)[number], string> = {
    error: t('logs.levels.error'),
    warn: t('logs.levels.warn'),
    info: t('logs.levels.info'),
    debug: t('logs.levels.debug'),
    trace: t('logs.levels.trace'),
  }
  const queryLevelLabels: Record<(typeof queryLevelOptions)[number], string> = {
    all: t('logs.levels.all'),
    ...logLevelLabels,
  }

  const logLevelData = runtimeLevelOptions.map((level) => ({
    value: level,
    label: logLevelLabels[level],
  }))
  const queryLevelData = queryLevelOptions.map((level) => ({
    value: level,
    label: queryLevelLabels[level],
  }))

  const applySearch = () => {
    setAppliedSearch(searchDraft.trim())
  }

  const saveSettings = async () => {
    const maxEntries = Number(settingsEntries)
    const maxBytesMb = Number(settingsMaxMb)
    if (!Number.isFinite(maxEntries) || !Number.isFinite(maxBytesMb)) return

    await updateLogSettingsMutation.mutateAsync({
      maxEntries: Math.round(maxEntries),
      maxBytes: Math.round(maxBytesMb * 1024 * 1024),
    })
    setSettingsOpen(false)
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[color:var(--shell-line)] bg-[color:var(--shell-surface)]/96 shadow-[0_10px_24px_color-mix(in_oklab,var(--foreground)_6%,transparent)] sm:rounded-[22px]">
      <div className="flex shrink-0 flex-col gap-2 border-b border-[color:var(--shell-line)]/80 p-3 sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[color:var(--shell-line)] bg-[color:var(--shell-surface-soft)] text-primary shadow-sm sm:h-10 sm:w-10">
            <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-foreground sm:text-lg">{t('logs.title')}</h3>
          </div>
        </div>

        <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-end">
          <div className="grid grid-cols-2 gap-2 sm:contents">
            <Select
              label={t('logs.runtimeLevel')}
              data={logLevelData}
              value={runtimeLevel}
              onChange={(level) => {
                if (level) setRuntimeLogLevelMutation.mutate(level)
              }}
              className="w-full sm:min-w-[7.5rem]"
            />
            <Select
              label={t('logs.queryLevel')}
              data={queryLevelData}
              value={queryLevel}
              onChange={(level) => {
                if (level) setQueryLevel(level)
              }}
              className="w-full sm:min-w-[7.5rem]"
            />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_2.25rem] items-end gap-2 sm:contents">
            <Input
              label={t('logs.search')}
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  applySearch()
                }
              }}
              wrapperClassName="min-w-0 sm:min-w-[13rem] sm:flex-1"
              placeholder={t('logs.searchPlaceholder')}
            />
            <SimpleTooltip label={t('logs.applyQuery')}>
              <Button variant="outline" size="icon" className="size-9 sm:size-8" onClick={applySearch}>
                <Search className="h-4 w-4" />
              </Button>
            </SimpleTooltip>
          </div>

          <div className="flex items-center justify-between gap-2 sm:contents">
            <label className="flex h-9 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-[color:var(--shell-line)] bg-[color:var(--shell-control)] px-3 text-xs font-semibold text-muted-foreground sm:flex-none sm:justify-start">
              <Switch size="xs" checked={autoScroll} onCheckedChange={setAutoScroll} />
              <span className="truncate">{t('logs.autoScroll')}</span>
            </label>
            <div className="flex shrink-0 items-center gap-2 sm:contents">
              <SimpleTooltip label={t('actions.refresh')}>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9 sm:size-8"
                  onClick={() => void logsQuery.refetch()}
                >
                  <RefreshCw className={cn('h-4 w-4', logsQuery.isFetching && 'animate-spin')} />
                </Button>
              </SimpleTooltip>
              <SimpleTooltip label={t('logs.settings')}>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9 sm:size-8"
                  onClick={() => setSettingsOpen(true)}
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
              </SimpleTooltip>
              <SimpleTooltip label={t('logs.clear')}>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9 text-destructive hover:text-destructive sm:size-8"
                  loading={clearLogsMutation.isPending}
                  onClick={async () => {
                    await clearLogsMutation.mutateAsync()
                    setEntries([])
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </SimpleTooltip>
            </div>
          </div>
        </div>
      </div>

      <div
        ref={logViewportRef}
        className="min-h-0 flex-1 overflow-y-auto bg-[color-mix(in_oklab,var(--background)_72%,var(--card))] p-2 font-mono text-[11px] leading-relaxed sm:p-4 sm:text-xs"
      >
        {entries.length === 0 ? (
          <div className="grid h-full min-h-[16rem] place-items-center text-sm text-muted-foreground">
            {logsQuery.isLoading ? t('logs.loading') : t('logs.empty')}
          </div>
        ) : (
          <div className="space-y-1.5">
            {entries.map((entry) => (
              <LogEntryItem key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-[calc(100vw-1rem)] p-4 sm:max-w-lg sm:p-6">
          <DialogHeader>
            <DialogTitle>{t('logs.settings')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <Input
              type="number"
              label={t('logs.maxEntries')}
              value={settingsEntries}
              min={settingsQuery.data?.minMaxEntries}
              max={settingsQuery.data?.maxMaxEntries}
              onChange={(event) => setSettingsEntries(event.target.value)}
              description={
                settingsQuery.data
                  ? t('logs.maxEntriesRange', {
                      min: settingsQuery.data.minMaxEntries,
                      max: settingsQuery.data.maxMaxEntries,
                    })
                  : undefined
              }
            />
            <Input
              type="number"
              label={t('logs.maxBytesMb')}
              value={settingsMaxMb}
              min={settingsQuery.data ? Math.round(settingsQuery.data.minMaxBytes / 1024 / 1024) : undefined}
              max={settingsQuery.data ? Math.round(settingsQuery.data.maxMaxBytes / 1024 / 1024) : undefined}
              onChange={(event) => setSettingsMaxMb(event.target.value)}
              description={
                settingsQuery.data
                  ? t('logs.maxBytesRange', {
                      min: formatBytes(settingsQuery.data.minMaxBytes),
                      max: formatBytes(settingsQuery.data.maxMaxBytes),
                    })
                  : undefined
              }
            />
            <p className="text-xs text-muted-foreground">{t('logs.settingsHint')}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              {t('confirmModal.cancel')}
            </Button>
            <Button loading={updateLogSettingsMutation.isPending} onClick={() => void saveSettings()}>
              {t('confirmModal.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
