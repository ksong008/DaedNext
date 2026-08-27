import type { MODE, ThemeId } from '~/constants'
import { persistentAtom, persistentMap } from '@nanostores/persistent'
import { atom, map } from 'nanostores'

import { COLS_PER_ROW, DEFAULT_ENDPOINT_URL, DEFAULT_THEME_ID } from '~/constants'

export type ColorScheme = 'light' | 'dark'
export type ThemeMode = 'system' | 'light' | 'dark'

export interface PersistentSortableKeys {
  nodeSortableKeys: string[]
  subscriptionSortableKeys: string[]
  configSortableKeys: string[]
  routingSortableKeys: string[]
  dnsSortableKeys: string[]
  groupSortableKeys: string[]
}

// Group-specific sort order storage (groupId -> { nodes: string[], subscriptions: string[] })
export interface GroupSortOrder {
  nodes: string[]
  subscriptions: string[]
}

export type GroupSortOrders = Record<string, GroupSortOrder>

// Profile/Preset type for saving and restoring configurations
export interface Profile {
  id: string
  name: string
  configID: string
  routingID: string
  dnsID: string
  createdAt: number
  updatedAt: number
}

export interface ProfilesState {
  profiles: Profile[]
  currentProfileID: string | null
}

export type AppState = {
  themeMode: ThemeMode
  colorTheme: ThemeId
  colsPerRow: number
} & PersistentSortableKeys

const DEFAULT_APP_STATE: AppState = {
  themeMode: 'system',
  colorTheme: DEFAULT_THEME_ID,
  colsPerRow: COLS_PER_ROW,
  nodeSortableKeys: [],
  subscriptionSortableKeys: [],
  configSortableKeys: [],
  routingSortableKeys: [],
  dnsSortableKeys: [],
  groupSortableKeys: [],
}

function safeDecode<T>(key: string, value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    try {
      globalThis.localStorage.removeItem(key)
    } catch {
    }
    return fallback
  }
}

type AppStateValue = AppState[keyof AppState]

function isAppStateValue(key: keyof AppState, value: unknown): value is AppStateValue {
  if (key === 'themeMode') return value === 'system' || value === 'light' || value === 'dark'
  if (key === 'colorTheme') return typeof value === 'string'
  if (key === 'colsPerRow') return typeof value === 'number' && Number.isFinite(value)
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function sanitizeAppStateStorage() {
  try {
    const storage = globalThis.localStorage
    for (const key of Object.keys(DEFAULT_APP_STATE) as Array<keyof AppState>) {
      const storageKey = `APP_STATE${key}`
      const value = storage.getItem(storageKey)
      if (value === null) continue
      try {
        if (!isAppStateValue(key, JSON.parse(value))) storage.removeItem(storageKey)
      } catch {
        storage.removeItem(storageKey)
      }
    }
  } catch {
  }
}

function safeDecodeAppStateValue(value: string): AppStateValue {
  try {
    return JSON.parse(value) as AppStateValue
  } catch {
    return ''
  }
}

sanitizeAppStateStorage()

export const modeAtom = persistentAtom<MODE>('mode')
export const tokenAtom = persistentAtom<string>('token')
export const endpointURLAtom = persistentAtom<string>('endpointURL', DEFAULT_ENDPOINT_URL)
export const themeMigrationVersionAtom = persistentAtom<string>('themeMigrationVersion', '')
export const appStateAtom = persistentMap<AppState>(
  'APP_STATE',
  DEFAULT_APP_STATE,
  {
    encode: JSON.stringify,
    decode: safeDecodeAppStateValue,
  },
)

export interface DEFAULT_RESOURCES {
  defaultConfigID: string
  defaultRoutingID: string
  defaultDNSID: string
  defaultGroupID: string
}

export const defaultResourcesAtom = map<DEFAULT_RESOURCES>({
  defaultConfigID: '',
  defaultRoutingID: '',
  defaultDNSID: '',
  defaultGroupID: '',
})

export const colorSchemeAtom = atom<ColorScheme>('dark')

// Persistent storage for group-specific sort orders
export const groupSortOrdersAtom = persistentAtom<GroupSortOrders>(
  'GROUP_SORT_ORDERS',
  {},
  {
    encode: JSON.stringify,
    decode: (value) => safeDecode('GROUP_SORT_ORDERS', value, {}),
  },
)

// Persistent storage for profiles/presets
export const profilesAtom = persistentAtom<ProfilesState>(
  'PROFILES',
  {
    profiles: [],
    currentProfileID: null,
  },
  {
    encode: JSON.stringify,
    decode: (value) =>
      safeDecode('PROFILES', value, {
        profiles: [],
        currentProfileID: null,
      }),
  },
)
