import type { DAEBundle, DAEConfigFileIssue } from '~/apis/types'
import type { BundleDiffPreview } from '~/utils/bundle'
import { useStore } from '@nanostores/react'
import {
  ArrowLeftRight,
  ChevronDown,
  Download,
  Keyboard,
  KeyRound,
  Languages,
  LogOut,
  Power,
  PowerOff,
  RefreshCw,
  Upload,
  UserPen,
} from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { toast } from 'sonner'
import { z } from 'zod'
import {
  useExportDAEBundleMutation,
  useExportDAEConfigFileMutation,
  useGeneralQuery,
  useImportDAEBundleMutation,
  useImportDAEConfigFileMutation,
  usePreviewDAEConfigFileMutation,
  useReloadRuntimeMutation,
  useStopRuntimeMutation,
  useUpdateAvatarMutation,
  useUpdateNameMutation,
  useUpdatePasswordMutation,
  useUpdateUsernameMutation,
  useUserQuery,
} from '~/apis'
import { normalizeEndpointURL } from '~/apis/client'
import { Avatar } from '~/components/ui/avatar'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { Input } from '~/components/ui/input'
import { Switch } from '~/components/ui/switch'
import { SimpleTooltip } from '~/components/ui/tooltip'
import { useColorScheme } from '~/contexts'
import { useDisclosure, useKeyboardShortcuts, useMediaQuery } from '~/hooks'
import { i18n } from '~/i18n'
import { cn } from '~/lib/utils'
import { endpointURLAtom, tokenAtom } from '~/store'
import { fileToBase64 } from '~/utils'
import { createBundleDiffPreview } from '~/utils/bundle'

import { BundleImportPreviewDialog } from './BundleImportPreviewDialog'
import { CommandPalette, useCommandPaletteActions } from './CommandPalette'
import { FormActions } from './FormActions'
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal'
import { ProfileSwitcher } from './ProfileSwitcher'
import { ThemePicker } from './ThemePicker'

function joinWarningMessages(warnings?: Array<{ message: string }>) {
  return warnings?.map((warning) => warning.message).join('\n') || ''
}

const fileExtensionPattern = /\.[^.]+$/

const accountSettingsSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  name: z.string().min(1),
})

const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

function RuntimeHealthStrip({ running }: { running?: boolean }) {
  const { t } = useTranslation()
  const label = typeof running === 'boolean' ? (running ? t('shell.running') : t('shell.stopped')) : '—'

  return (
    <div className="hidden shrink-0 items-center overflow-hidden md:flex" aria-label={label} title={label}>
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[color:var(--shell-line)] bg-[color:var(--shell-control)]',
          running === true && 'text-primary',
          running === false && 'text-destructive',
          typeof running !== 'boolean' && 'text-muted-foreground',
        )}
      >
        {running ? <Power className="h-4 w-4 shrink-0" /> : <PowerOff className="h-4 w-4 shrink-0" />}
      </div>
    </div>
  )
}

const mobileHeaderButtonClassName =
  'h-[30px] w-[30px] shrink-0 rounded-lg border-[color:var(--shell-line)] bg-[color:var(--shell-surface)]/50 p-0 shadow-none transition-colors hover:bg-[color:var(--shell-surface-soft)]/72'

const desktopHeaderIconButtonClassName = 'rounded-lg border-border/75 bg-background/72'
const showHeaderRuntimeStatus = false

function MobileRuntimeHealthStrip({ running }: { running?: boolean }) {
  const { t } = useTranslation()
  const label = typeof running === 'boolean' ? (running ? t('shell.running') : t('shell.stopped')) : '—'

  return (
    <div className="flex shrink-0 items-center whitespace-nowrap" aria-label={label} title={label}>
      <span
        className={cn(
          'inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border border-[color:var(--shell-line)] bg-[color:var(--shell-surface)]/50',
          running === true && 'text-primary',
          running === false && 'text-destructive',
          typeof running !== 'boolean' && 'text-muted-foreground',
        )}
      >
        {running ? <Power className="h-3.5 w-3.5 shrink-0" /> : <PowerOff className="h-3.5 w-3.5 shrink-0" />}
      </span>
    </div>
  )
}

export function HeaderWithActions() {
  const { t } = useTranslation()
  const endpointURL = useStore(endpointURLAtom)
  const normalizedEndpointURL = normalizeEndpointURL(endpointURL)
  const { themeMode, setThemeMode } = useColorScheme()

  const cycleThemeMode = () => {
    const modes: Array<'system' | 'light' | 'dark'> = ['system', 'light', 'dark']
    const currentIndex = modes.indexOf(themeMode)
    const nextIndex = (currentIndex + 1) % modes.length
    setThemeMode(modes[nextIndex])
  }

  const [userMenuOpened, setUserMenuOpened] = useState(false)
  const [openedAccountSettingsFormModal, { open: openAccountSettingsFormModal, close: closeAccountSettingsFormModal }] =
    useDisclosure(false)
  const [openedPasswordChangeModal, { open: openPasswordChangeModal, close: closePasswordChangeModal }] =
    useDisclosure(false)
  const [openedShortcutsModal, { open: openShortcutsModal, close: closeShortcutsModal }] = useDisclosure(false)
  const [openedCommandPalette, { open: openCommandPalette, close: closeCommandPalette }] = useDisclosure(false)
  const [openedBundlePreview, { open: openBundlePreview, close: closeBundlePreview }] = useDisclosure(false)
  const { data: userQuery } = useUserQuery()
  const { data: generalQuery } = useGeneralQuery()
  const reloadRuntimeMutation = useReloadRuntimeMutation()
  const stopRuntimeMutation = useStopRuntimeMutation()
  const runtimeMutationPending = reloadRuntimeMutation.isPending || stopRuntimeMutation.isPending
  const needsReload = generalQuery?.general.dae.modified ?? false
  const updateNameMutation = useUpdateNameMutation()
  const updatePasswordMutation = useUpdatePasswordMutation()
  const updateUsernameMutation = useUpdateUsernameMutation()
  const updateAvatarMutation = useUpdateAvatarMutation()
  const exportBundleMutation = useExportDAEBundleMutation()
  const importBundleMutation = useImportDAEBundleMutation()
  const exportDAEConfigFileMutation = useExportDAEConfigFileMutation()
  const importDAEConfigFileMutation = useImportDAEConfigFileMutation()
  const previewDAEConfigFileMutation = usePreviewDAEConfigFileMutation()
  const [uploadingAvatarBase64, setUploadingAvatarBase64] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bundleInputRef = useRef<HTMLInputElement>(null)
  const daeConfigFileInputRef = useRef<HTMLInputElement>(null)
  const [pendingBundleImport, setPendingBundleImport] = useState<DAEBundle | null>(null)
  const [pendingDAEConfigFileImport, setPendingDAEConfigFileImport] = useState<{
    filename?: string
    namePrefix?: string
    content: string
  } | null>(null)
  const [bundleDiffPreview, setBundleDiffPreview] = useState<BundleDiffPreview | null>(null)
  const [bundleImportFileName, setBundleImportFileName] = useState('')
  const [previewWarnings, setPreviewWarnings] = useState<DAEConfigFileIssue[]>([])
  const [previewKind, setPreviewKind] = useState<'bundle' | 'daeFile' | null>(null)
  const [formData, setFormData] = useState({ username: '', name: '' })
  const [formErrors, setFormErrors] = useState<{ username?: string; name?: string }>({})
  const [passwordFormData, setPasswordFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordFormErrors, setPasswordFormErrors] = useState<{
    currentPassword?: string
    newPassword?: string
    confirmPassword?: string
  }>({})

  const matchSmallScreen = useMediaQuery('(max-width: 640px)')

  // Toggle language function
  const toggleLanguage = useCallback(() => {
    if (i18n.language.startsWith('zh')) {
      i18n.changeLanguage('en')
    } else {
      i18n.changeLanguage('zh-Hans')
    }
  }, [])

  // Toggle running state function
  const setRuntimeRunning = useCallback(
    (running: boolean) => {
      if (runtimeMutationPending) {
        return
      }
      if (running) {
        reloadRuntimeMutation.mutate({ dry: false })
      } else {
        stopRuntimeMutation.mutate()
      }
    },
    [reloadRuntimeMutation, runtimeMutationPending, stopRuntimeMutation],
  )

  const toggleRunning = useCallback(() => {
    if (!runtimeMutationPending && generalQuery?.general.dae.running !== undefined) {
      setRuntimeRunning(!generalQuery.general.dae.running)
    }
  }, [generalQuery, runtimeMutationPending, setRuntimeRunning])

  // Reload configuration function
  const reloadConfig = useCallback(() => {
    if (!runtimeMutationPending && generalQuery?.general.dae.modified) {
      reloadRuntimeMutation.mutate({ dry: false })
    }
  }, [generalQuery, reloadRuntimeMutation, runtimeMutationPending])

  // Command palette actions
  const commandPaletteActions = useCommandPaletteActions({
    cycleThemeMode,
    toggleLanguage,
    toggleRunning,
    reloadConfig,
    openShortcutsModal,
    themeMode,
    isModified: generalQuery?.general.dae.modified ?? false,
  })

  // Keyboard shortcuts (only for non-command palette shortcuts)
  useKeyboardShortcuts({
    shortcuts: [
      {
        key: '?',
        action: openShortcutsModal,
        description: 'Show keyboard shortcuts',
      },
      {
        key: 'd',
        ctrl: true,
        action: cycleThemeMode,
        description: 'Toggle theme',
      },
      {
        key: 'l',
        ctrl: true,
        action: toggleLanguage,
        description: 'Toggle language',
      },
      {
        key: 's',
        ctrl: true,
        action: toggleRunning,
        description: 'Toggle running state',
      },
      {
        key: 'r',
        ctrl: true,
        action: reloadConfig,
        description: 'Reload configuration',
        disabled: !generalQuery?.general.dae.modified,
      },
      {
        key: 'Escape',
        action: () => {
          closeShortcutsModal()
          closeCommandPalette()
          closeAccountSettingsFormModal()
          closePasswordChangeModal()
        },
        description: 'Close modals',
      },
    ],
  })

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const result = accountSettingsSchema.safeParse(formData)

    if (!result.success) {
      const errors: typeof formErrors = {}
      result.error.issues.forEach((issue) => {
        const path = issue.path[0] as keyof typeof formErrors
        errors[path] = issue.message
      })
      setFormErrors(errors)

      return
    }

    if (formData.username !== userQuery?.user?.username) {
      await updateUsernameMutation.mutateAsync(formData.username)
    }

    if (formData.name !== userQuery?.user?.name) {
      await updateNameMutation.mutateAsync(formData.name)
    }

    if (uploadingAvatarBase64 && uploadingAvatarBase64 !== userQuery?.user?.avatar) {
      await updateAvatarMutation.mutateAsync(uploadingAvatarBase64)
    }

    closeAccountSettingsFormModal()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]

    if (file) {
      const avatarBase64 = await fileToBase64(file)
      setUploadingAvatarBase64(avatarBase64)
    }
  }

  const handleExportBundle = useCallback(async () => {
    try {
      const bundle = await exportBundleMutation.mutateAsync()
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `daed-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      link.click()
      URL.revokeObjectURL(url)
      toast.success(t('bundle.exportSuccess'))
    } catch {
      // API client already reports request errors.
    }
  }, [exportBundleMutation, t])

  const handleImportBundle = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) {
        return
      }

      try {
        const bundle = JSON.parse(await file.text()) as DAEBundle
        if (
          !bundle ||
          typeof bundle !== 'object' ||
          !Array.isArray(bundle.configs) ||
          !Array.isArray(bundle.dnss) ||
          !Array.isArray(bundle.routings) ||
          !Array.isArray(bundle.subscriptions) ||
          !Array.isArray(bundle.nodes) ||
          !Array.isArray(bundle.groups)
        ) {
          throw new Error(t('bundle.importInvalid'))
        }

        const currentBundle = await exportBundleMutation.mutateAsync()
        setPendingBundleImport(bundle)
        setPendingDAEConfigFileImport(null)
        setBundleImportFileName(file.name)
        setPreviewWarnings([])
        setBundleDiffPreview(createBundleDiffPreview(currentBundle, bundle))
        setPreviewKind('bundle')
        openBundlePreview()
      } catch (error) {
        const message = error instanceof Error && error.message ? error.message : t('bundle.importInvalid')
        toast.error(message)
      } finally {
        event.target.value = ''
      }
    },
    [exportBundleMutation, openBundlePreview, t],
  )

  const closeBundlePreviewState = useCallback(() => {
    setPendingBundleImport(null)
    setPendingDAEConfigFileImport(null)
    setBundleDiffPreview(null)
    setBundleImportFileName('')
    setPreviewWarnings([])
    setPreviewKind(null)
    closeBundlePreview()
  }, [closeBundlePreview])

  const confirmBundleImport = useCallback(async () => {
    if (previewKind === 'bundle') {
      if (!pendingBundleImport) {
        return
      }
      try {
        await importBundleMutation.mutateAsync(pendingBundleImport)
        toast.success(t('bundle.importSuccess'))
        closeBundlePreviewState()
      } catch {
        // API client already reports request errors.
      }
      return
    }

    if (!pendingDAEConfigFileImport) {
      return
    }
    try {
      const result = await importDAEConfigFileMutation.mutateAsync(pendingDAEConfigFileImport)
      if (result.warnings?.length) {
        toast.warning(joinWarningMessages(result.warnings))
      } else {
        toast.success(t('daeFile.importSuccess'))
      }
      closeBundlePreviewState()
    } catch {
      // API client already reports request errors.
    }
  }, [
    closeBundlePreviewState,
    importBundleMutation,
    importDAEConfigFileMutation,
    pendingBundleImport,
    pendingDAEConfigFileImport,
    previewKind,
    t,
  ])

  const handleExportDAEConfigFile = useCallback(async () => {
    try {
      const exported = await exportDAEConfigFileMutation.mutateAsync()
      const blob = new Blob([exported.content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = exported.filename || `dae-${new Date().toISOString().replace(/[:.]/g, '-')}.dae`
      link.click()
      URL.revokeObjectURL(url)
      if (exported.warnings?.length) {
        toast.warning(joinWarningMessages(exported.warnings))
      } else {
        toast.success(t('daeFile.exportSuccess'))
      }
    } catch {
      // API client already reports request errors.
    }
  }, [exportDAEConfigFileMutation, t])

  const handleImportDAEConfigFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) {
        return
      }

      try {
        const content = await file.text()
        const namePrefix = file.name.replace(fileExtensionPattern, '')
        const payload = {
          filename: file.name,
          namePrefix,
          content,
        }
        const [currentBundle, preview] = await Promise.all([
          exportBundleMutation.mutateAsync(),
          previewDAEConfigFileMutation.mutateAsync(payload),
        ])
        setPendingDAEConfigFileImport(payload)
        setPendingBundleImport(null)
        setBundleImportFileName(file.name)
        setPreviewWarnings(preview.warnings || [])
        setBundleDiffPreview(createBundleDiffPreview(currentBundle, preview.bundle))
        setPreviewKind('daeFile')
        openBundlePreview()
      } catch (error) {
        const message = error instanceof Error && error.message ? error.message : t('daeFile.importInvalid')
        toast.error(message)
      } finally {
        event.target.value = ''
      }
    },
    [exportBundleMutation, openBundlePreview, previewDAEConfigFileMutation, t],
  )

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const result = passwordChangeSchema.safeParse(passwordFormData)

    if (!result.success) {
      const errors: typeof passwordFormErrors = {}
      result.error.issues.forEach((issue) => {
        const path = issue.path[0] as keyof typeof passwordFormErrors
        errors[path] = issue.message
      })
      setPasswordFormErrors(errors)

      return
    }

    try {
      const token = await updatePasswordMutation.mutateAsync({
        currentPassword: passwordFormData.currentPassword,
        newPassword: passwordFormData.newPassword,
      })

      // Update token with the new one
      if (typeof token === 'string' && token) {
        tokenAtom.set(token)
      }

      setPasswordFormData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setPasswordFormErrors({})
      closePasswordChangeModal()
    } catch {
      setPasswordFormErrors({ currentPassword: t('password.current.incorrect') })
    }
  }

  const runtimeSwitchControl = (
    <SimpleTooltip label={t('actions.switchRunning')}>
      <div
        className={cn(
          'flex items-center justify-center border',
          matchSmallScreen
            ? 'h-[30px] min-w-[50px] shrink-0 rounded-[14px] border-[color:var(--shell-line)] bg-[color:var(--shell-surface)]/50 px-2 shadow-none'
            : 'rounded-xl border-border/75 bg-background/72 px-2 py-1 shadow-[0_4px_10px_color-mix(in_oklab,var(--foreground)_5%,transparent)]',
        )}
      >
        <Switch
          size={matchSmallScreen ? 'xs' : 'md'}
          onLabel={<Power className="h-3 w-3" />}
          offLabel={<PowerOff className="h-3 w-3" />}
          disabled={runtimeMutationPending}
          checked={generalQuery?.general.dae.running ?? false}
          onCheckedChange={(checked) => {
            setRuntimeRunning(checked)
          }}
        />
      </div>
    </SimpleTooltip>
  )

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--shell-line)] bg-[color:var(--shell-page)]/82 backdrop-blur-[24px] supports-[backdrop-filter]:bg-[color:var(--shell-page)]/78">
      <div
        className={cn(
          'mx-auto w-full max-w-[1480px]',
          matchSmallScreen
            ? 'flex min-h-[60px] items-center gap-2 px-3 py-2'
            : 'grid min-h-[74px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:px-5 lg:px-7',
        )}
      >
        {matchSmallScreen && (
          <div className="flex h-full shrink-0 items-center justify-center">
            <img
              src="/logo.webp"
              alt="DAED"
              className="h-11 w-11 shrink-0 rounded-[14px] object-cover shadow-[0_6px_16px_color-mix(in_oklab,var(--foreground)_10%,transparent)]"
            />
          </div>
        )}

        {!matchSmallScreen && showHeaderRuntimeStatus && (
          <div className="flex min-w-0 items-center">
            <RuntimeHealthStrip running={generalQuery?.general.dae.running} />
          </div>
        )}

        <div
          className={cn(
            'flex items-center',
            matchSmallScreen
              ? 'min-w-0 flex-1 justify-end gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
              : 'justify-end gap-2',
          )}
        >
          <input
            ref={bundleInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleImportBundle}
          />
          <input
            ref={daeConfigFileInputRef}
            type="file"
            accept=".dae,text/plain"
            className="hidden"
            onChange={handleImportDAEConfigFile}
          />

          {!matchSmallScreen && <ProfileSwitcher />}

          {matchSmallScreen && showHeaderRuntimeStatus && (
            <div className="mr-auto flex shrink-0 items-center">
              <MobileRuntimeHealthStrip running={generalQuery?.general.dae.running} />
            </div>
          )}

          {(needsReload || reloadRuntimeMutation.isPending) && (
            <Button
              variant="outline"
              size={matchSmallScreen ? 'icon-sm' : 'sm'}
              className={cn(
                matchSmallScreen
                  ? mobileHeaderButtonClassName
                  : 'rounded-xl border-primary/30 bg-primary/8 text-primary shadow-[0_4px_10px_color-mix(in_oklab,var(--foreground)_5%,transparent)] hover:bg-primary/12',
              )}
              disabled={runtimeMutationPending || !needsReload}
              loading={reloadRuntimeMutation.isPending}
              onClick={reloadConfig}
            >
              <RefreshCw className="h-4 w-4" />
              {!matchSmallScreen && <span>{t('actions.reload')}</span>}
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size={matchSmallScreen ? 'icon-sm' : 'sm'}
                className={cn(
                  matchSmallScreen
                    ? mobileHeaderButtonClassName
                    : 'rounded-xl border-border/75 bg-background/72 shadow-[0_4px_10px_color-mix(in_oklab,var(--foreground)_5%,transparent)]',
                )}
                aria-label={t('shell.transfer')}
              >
                <ArrowLeftRight className="h-4 w-4" />
                {!matchSmallScreen && <span>{t('shell.transfer')}</span>}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[220px]">
              <DropdownMenuLabel>{t('shell.transfer')}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => void handleExportDAEConfigFile()}>
                <Download className="mr-2 h-4 w-4" />
                {t('daeFile.export')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => daeConfigFileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                {t('daeFile.import')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleExportBundle()}>
                <Download className="mr-2 h-4 w-4" />
                {t('bundle.export')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => bundleInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                {t('bundle.import')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <SimpleTooltip label={t('actions.switchLanguage')}>
            <Button
              variant="outline"
              size="icon-sm"
              className={cn(matchSmallScreen ? mobileHeaderButtonClassName : desktopHeaderIconButtonClassName)}
              onClick={toggleLanguage}
            >
              <Languages className="h-4 w-4" />
            </Button>
          </SimpleTooltip>

          <ThemePicker
            triggerClassName={matchSmallScreen ? mobileHeaderButtonClassName : desktopHeaderIconButtonClassName}
            triggerIconClassName="h-4 w-4"
          />

          {runtimeSwitchControl}

          <DropdownMenu open={userMenuOpened} onOpenChange={setUserMenuOpened}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left transition-colors',
                  matchSmallScreen
                    ? 'h-[30px] shrink-0 rounded-[14px] border-[color:var(--shell-line)] bg-[color:var(--shell-surface)]/50 px-2 py-0 shadow-none hover:bg-[color:var(--shell-surface-soft)]/72'
                    : 'border-border/75 bg-background/75 shadow-[0_4px_10px_color-mix(in_oklab,var(--foreground)_5%,transparent)] hover:bg-background',
                  userMenuOpened && 'border-border bg-background',
                )}
              >
                <Avatar
                  src={userQuery?.user?.avatar || 'https://avatars.githubusercontent.com/u/126714249?s=200&v=4'}
                  alt="avatar"
                  size={matchSmallScreen ? 22 : 24}
                />
                {!matchSmallScreen && (
                  <span className="max-w-[7rem] truncate text-sm font-semibold leading-none">
                    {userQuery?.user?.name || userQuery?.user?.username || 'unknown'}
                  </span>
                )}
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 text-muted-foreground transition-transform',
                    userMenuOpened && 'rotate-180',
                  )}
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[220px]">
              <DropdownMenuLabel>{userQuery?.user?.name || userQuery?.user?.username || 'unknown'}</DropdownMenuLabel>
              {normalizedEndpointURL && (
                <DropdownMenuLabel className="pt-0 text-[11px] font-medium text-muted-foreground">
                  {normalizedEndpointURL}
                </DropdownMenuLabel>
              )}
              <DropdownMenuItem
                onClick={() => {
                  setFormData({
                    username: userQuery?.user?.username || '',
                    name: userQuery?.user?.name || '',
                  })
                  setFormErrors({})
                  openAccountSettingsFormModal()
                }}
              >
                <UserPen className="mr-2 h-4 w-4" />
                {t('account settings')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setPasswordFormData({ currentPassword: '', newPassword: '', confirmPassword: '' })
                  setPasswordFormErrors({})
                  openPasswordChangeModal()
                }}
              >
                <KeyRound className="mr-2 h-4 w-4" />
                {t('password.change')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={openShortcutsModal}>
                <Keyboard className="mr-2 h-4 w-4" />
                {t('shortcuts.title')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => tokenAtom.set('')}>
                <LogOut className="mr-2 h-4 w-4" />
                {t('actions.logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={openedAccountSettingsFormModal} onOpenChange={closeAccountSettingsFormModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('account settings')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFormSubmit}>
            <div className="space-y-4">
              <Input
                label={t('username')}
                withAsterisk
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                error={formErrors.username}
              />

              <Input
                label={t('display name')}
                withAsterisk
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={formErrors.name}
              />

              <div className="flex justify-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  className="w-[100px] h-[100px] rounded-full overflow-hidden border-2 border-dashed border-muted-foreground hover:border-primary transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadingAvatarBase64 || userQuery?.user?.avatar ? (
                    <img
                      src={uploadingAvatarBase64 || userQuery?.user?.avatar || undefined}
                      alt={t('avatar')}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Avatar className="w-full h-full" />
                  )}
                </button>
              </div>

              <FormActions
                reset={() => {
                  setUploadingAvatarBase64(null)
                  setFormData({
                    username: userQuery?.user?.username || '',
                    name: userQuery?.user?.name || '',
                  })

                  if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                  }
                }}
                isDirty={
                  formData.username !== (userQuery?.user?.username || '') ||
                  formData.name !== (userQuery?.user?.name || '') ||
                  (uploadingAvatarBase64 !== null && uploadingAvatarBase64 !== userQuery?.user?.avatar)
                }
                isValid={formData.username.length >= 1 && formData.name.length >= 1}
              />
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={openedPasswordChangeModal} onOpenChange={closePasswordChangeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('password.change')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePasswordChangeSubmit}>
            <div className="space-y-4">
              <Input
                type="password"
                label={t('password.current')}
                placeholder={t('password.current.placeholder')}
                value={passwordFormData.currentPassword}
                onChange={(e) => setPasswordFormData({ ...passwordFormData, currentPassword: e.target.value })}
                error={passwordFormErrors.currentPassword}
              />
              <Input
                type="password"
                label={t('password.new')}
                placeholder={t('password.new.placeholder')}
                value={passwordFormData.newPassword}
                onChange={(e) => setPasswordFormData({ ...passwordFormData, newPassword: e.target.value })}
                error={passwordFormErrors.newPassword}
              />
              <Input
                type="password"
                label={t('password.confirm')}
                placeholder={t('password.confirm.placeholder')}
                value={passwordFormData.confirmPassword}
                onChange={(e) => setPasswordFormData({ ...passwordFormData, confirmPassword: e.target.value })}
                error={passwordFormErrors.confirmPassword}
              />
              <Button type="submit" className="w-full" loading={updatePasswordMutation.isPending}>
                {t('password.update')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <KeyboardShortcutsModal opened={openedShortcutsModal} onClose={closeShortcutsModal} />

      <BundleImportPreviewDialog
        open={openedBundlePreview}
        fileName={bundleImportFileName}
        preview={bundleDiffPreview}
        warnings={previewWarnings}
        loading={importBundleMutation.isPending || importDAEConfigFileMutation.isPending}
        title={previewKind === 'daeFile' ? t('daeFile.previewTitle') : t('bundle.previewTitle')}
        description={previewKind === 'daeFile' ? t('daeFile.previewDesc') : t('bundle.previewDesc')}
        fileLabel={previewKind === 'daeFile' ? t('daeFile.previewFile') : t('bundle.previewFile')}
        warningTitle={previewKind === 'daeFile' ? t('daeFile.previewWarningTitle') : t('bundle.previewWarningTitle')}
        warningDescription={previewKind === 'daeFile' ? t('daeFile.importConfirm') : t('bundle.importConfirm')}
        noChangesTitle={
          previewKind === 'daeFile' ? t('daeFile.previewNoChangesTitle') : t('bundle.previewNoChangesTitle')
        }
        noChangesDescription={
          previewKind === 'daeFile' ? t('daeFile.previewNoChangesDesc') : t('bundle.previewNoChangesDesc')
        }
        confirmLabel={previewKind === 'daeFile' ? t('daeFile.confirmImport') : t('bundle.confirmImport')}
        onOpenChange={(open) => {
          if (!open) {
            closeBundlePreviewState()
          }
        }}
        onConfirm={() => void confirmBundleImport()}
      />

      <CommandPalette
        open={openedCommandPalette}
        onOpenChange={(open) => (open ? openCommandPalette() : closeCommandPalette())}
        actions={commandPaletteActions}
      />
    </header>
  )
}
