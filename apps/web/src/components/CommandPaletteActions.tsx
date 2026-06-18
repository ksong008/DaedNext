import type { ReactNode } from 'react'
import { Keyboard, Languages, Monitor, Moon, RefreshCw, Sun, Wifi } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export interface CommandAction {
  id: string
  label: string
  icon?: ReactNode
  shortcut?: string[]
  action: () => void
  disabled?: boolean
  group: 'general' | 'appearance' | 'actions'
}

export function useCommandPaletteActions({
  cycleThemeMode,
  toggleLanguage,
  toggleRunning,
  reloadConfig,
  openShortcutsModal,
  themeMode,
  isModified,
}: {
  cycleThemeMode: () => void
  toggleLanguage: () => void
  toggleRunning: () => void
  reloadConfig: () => void
  openShortcutsModal: () => void
  themeMode: 'system' | 'light' | 'dark'
  isModified: boolean
}): CommandAction[] {
  const { t } = useTranslation()

  const getThemeIcon = useCallback(() => {
    switch (themeMode) {
      case 'system':
        return <Monitor className="h-4 w-4" />
      case 'light':
        return <Sun className="h-4 w-4" />
      case 'dark':
        return <Moon className="h-4 w-4" />
    }
  }, [themeMode])

  return useMemo(() => {
    const actions: CommandAction[] = [
      {
        id: 'help',
        label: t('shortcuts.help'),
        icon: <Keyboard className="h-4 w-4" />,
        shortcut: ['?'],
        action: openShortcutsModal,
        group: 'general',
      },
      {
        id: 'toggle-theme',
        label: t('shortcuts.toggleTheme'),
        icon: getThemeIcon(),
        shortcut: ['Ctrl/⌘', 'D'],
        action: cycleThemeMode,
        group: 'appearance',
      },
      {
        id: 'toggle-language',
        label: t('shortcuts.toggleLanguage'),
        icon: <Languages className="h-4 w-4" />,
        shortcut: ['Ctrl/⌘', 'L'],
        action: toggleLanguage,
        group: 'appearance',
      },
      {
        id: 'toggle-running',
        label: t('shortcuts.toggleRunning'),
        icon: <Wifi className="h-4 w-4" />,
        shortcut: ['Ctrl/⌘', 'S'],
        action: toggleRunning,
        group: 'actions',
      },
    ]

    if (isModified) {
      actions.push({
        id: 'reload-config',
        label: t('shortcuts.reload'),
        icon: <RefreshCw className="h-4 w-4" />,
        shortcut: ['Ctrl/⌘', 'R'],
        action: reloadConfig,
        group: 'actions',
      })
    }

    return actions
  }, [t, cycleThemeMode, toggleLanguage, toggleRunning, reloadConfig, openShortcutsModal, getThemeIcon, isModified])
}
