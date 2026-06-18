import type { CommandAction } from './CommandPaletteActions'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '~/components/ui/command'
import { Kbd, KbdGroup } from '~/components/ui/kbd'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  actions: CommandAction[]
}

const macPlatformPattern = /Mac|iPod|iPhone|iPad/

// Helper to detect Mac platform
function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  if ('userAgentData' in navigator && (navigator.userAgentData as { platform?: string }).platform) {
    return (navigator.userAgentData as { platform: string }).platform === 'macOS'
  }
  return macPlatformPattern.test(navigator.userAgent)
}

// Format shortcut for display
function formatShortcut(keys: string[]): string[] {
  const isMac = isMacPlatform()
  return keys.map((key) => {
    if (key === 'Ctrl/⌘') {
      return isMac ? '⌘' : 'Ctrl'
    }
    return key
  })
}

export function CommandPalette({ open, onOpenChange, actions }: CommandPaletteProps) {
  const { t } = useTranslation()

  // Group actions by category
  const groupedActions = useMemo(() => {
    const groups: Record<string, CommandAction[]> = {
      general: [],
      appearance: [],
      actions: [],
    }

    for (const action of actions) {
      if (groups[action.group]) {
        groups[action.group].push(action)
      }
    }

    return groups
  }, [actions])

  const handleSelect = (action: CommandAction) => {
    if (!action.disabled) {
      action.action()
      onOpenChange(false)
    }
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('shortcuts.commandPalette')}
      description={t('shortcuts.tip')}
    >
      <CommandInput placeholder={`${t('shortcuts.commandPalette')}...`} />
      <CommandList>
        <CommandEmpty>{t('empty')}</CommandEmpty>

        {groupedActions.general.length > 0 && (
          <CommandGroup heading={t('shortcuts.categories.general')}>
            {groupedActions.general.map((action) => (
              <CommandItem key={action.id} onSelect={() => handleSelect(action)} disabled={action.disabled}>
                {action.icon}
                <span>{action.label}</span>
                {action.shortcut && (
                  <CommandShortcut>
                    <KbdGroup>
                      {formatShortcut(action.shortcut).map((key, index) => (
                        <Kbd key={index}>{key}</Kbd>
                      ))}
                    </KbdGroup>
                  </CommandShortcut>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {groupedActions.appearance.length > 0 && (
          <CommandGroup heading={t('shortcuts.categories.appearance')}>
            {groupedActions.appearance.map((action) => (
              <CommandItem key={action.id} onSelect={() => handleSelect(action)} disabled={action.disabled}>
                {action.icon}
                <span>{action.label}</span>
                {action.shortcut && (
                  <CommandShortcut>
                    <KbdGroup>
                      {formatShortcut(action.shortcut).map((key, index) => (
                        <Kbd key={index}>{key}</Kbd>
                      ))}
                    </KbdGroup>
                  </CommandShortcut>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {groupedActions.actions.length > 0 && (
          <CommandGroup heading={t('shortcuts.categories.actions')}>
            {groupedActions.actions.map((action) => (
              <CommandItem key={action.id} onSelect={() => handleSelect(action)} disabled={action.disabled}>
                {action.icon}
                <span>{action.label}</span>
                {action.shortcut && (
                  <CommandShortcut>
                    <KbdGroup>
                      {formatShortcut(action.shortcut).map((key, index) => (
                        <Kbd key={index}>{key}</Kbd>
                      ))}
                    </KbdGroup>
                  </CommandShortcut>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
